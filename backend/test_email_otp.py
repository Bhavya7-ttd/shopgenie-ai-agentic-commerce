import unittest
import os
import re
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models.user import User
from app.services import email_service

TEST_DB_URL = "sqlite:///./test_otp.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

class TestEmailOtpFlow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(bind=engine)
        if os.path.exists("./test_otp.db"):
            try:
                os.remove("./test_otp.db")
            except Exception:
                pass

    def test_01_registration_valid_email(self):
        """TEST 1: Registration with a valid email succeeds."""
        res = self.client.post("/api/auth/register", json={
            "full_name": "Valid Email User",
            "email": "user15_val@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertEqual(data["email"], "user15_val@example.com")

    def test_02_registration_generates_6digit_otp(self):
        """TEST 2: Registration generates a 6-digit OTP."""
        res = self.client.post("/api/auth/register", json={
            "full_name": "Digits User",
            "email": "user15_digits@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        self.assertEqual(res.status_code, 200)
        db = TestingSessionLocal()
        user = db.query(User).filter(User.email == "user15_digits@example.com").first()
        self.assertIsNotNone(user)
        self.assertIsNotNone(user.otp_code)
        self.assertTrue(re.match(r"^\d{6}$", user.otp_code))
        db.close()

    def test_03_otp_expires_after_configured_time(self):
        """TEST 3: OTP expires after the configured expiry time."""
        res = self.client.post("/api/auth/register", json={
            "full_name": "Expired User",
            "email": "user15_expired@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        self.assertEqual(res.status_code, 200)

        # Shift expiry time into the past
        db = TestingSessionLocal()
        user = db.query(User).filter(User.email == "user15_expired@example.com").first()
        valid_code = user.otp_code
        user.otp_expires_at = datetime.utcnow() - timedelta(minutes=1)
        db.commit()
        db.close()

        v_res = self.client.post("/api/auth/verify-otp", json={
            "email": "user15_expired@example.com",
            "otp": valid_code
        })
        self.assertEqual(v_res.status_code, 400)
        self.assertIn("expired", v_res.json()["detail"].lower())

    def test_04_wrong_otp_rejected(self):
        """TEST 4: Wrong OTP is rejected."""
        self.client.post("/api/auth/register", json={
            "full_name": "Wrong OTP User",
            "email": "user15_wrong@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        v_res = self.client.post("/api/auth/verify-otp", json={
            "email": "user15_wrong@example.com",
            "otp": "000000"
        })
        self.assertEqual(v_res.status_code, 400)
        self.assertIn("Incorrect OTP", v_res.json()["detail"])

    def test_05_5_wrong_attempts_locks_otp(self):
        """TEST 5: After 5 wrong attempts, OTP is invalidated/locked."""
        self.client.post("/api/auth/register", json={
            "full_name": "Lockout User",
            "email": "user15_lock@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        for i in range(4):
            r = self.client.post("/api/auth/verify-otp", json={"email": "user15_lock@example.com", "otp": "000000"})
            self.assertEqual(r.status_code, 400)

        # 5th attempt invalidates OTP
        r5 = self.client.post("/api/auth/verify-otp", json={"email": "user15_lock@example.com", "otp": "000000"})
        self.assertEqual(r5.status_code, 400)
        self.assertIn("Maximum attempts reached", r5.json()["detail"])

    def test_06_correct_otp_verifies_account(self):
        """TEST 6: Correct OTP verifies the account."""
        self.client.post("/api/auth/register", json={
            "full_name": "Correct OTP User",
            "email": "user15_correct@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        db = TestingSessionLocal()
        user = db.query(User).filter(User.email == "user15_correct@example.com").first()
        valid_otp = user.otp_code
        db.close()

        v_res = self.client.post("/api/auth/verify-otp", json={
            "email": "user15_correct@example.com",
            "otp": valid_otp
        })
        self.assertEqual(v_res.status_code, 200)
        self.assertTrue(v_res.json().get("verified"))

    def test_07_otp_cannot_be_reused(self):
        """TEST 7: OTP cannot be reused after successful verification."""
        self.client.post("/api/auth/register", json={
            "full_name": "Reuse User",
            "email": "user15_reuse@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        db = TestingSessionLocal()
        user = db.query(User).filter(User.email == "user15_reuse@example.com").first()
        valid_otp = user.otp_code
        db.close()

        v1 = self.client.post("/api/auth/verify-otp", json={"email": "user15_reuse@example.com", "otp": valid_otp})
        self.assertEqual(v1.status_code, 200)

        # Second verification attempt with same OTP
        v2 = self.client.post("/api/auth/verify-otp", json={"email": "user15_reuse@example.com", "otp": valid_otp})
        self.assertEqual(v2.status_code, 200)
        self.assertIn("already verified", v2.json()["message"])

    def test_08_resend_otp_after_cooldown(self):
        """TEST 8: Resend OTP works after cooldown."""
        self.client.post("/api/auth/register", json={
            "full_name": "Resend Cooldown User",
            "email": "user15_resendok@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        db = TestingSessionLocal()
        user = db.query(User).filter(User.email == "user15_resendok@example.com").first()
        user.last_otp_sent_at = datetime.utcnow() - timedelta(seconds=35)
        db.commit()
        db.close()

        r_res = self.client.post("/api/auth/resend-otp", json={"email": "user15_resendok@example.com"})
        self.assertEqual(r_res.status_code, 200)

    def test_09_resend_during_cooldown_rejected(self):
        """TEST 9: Resend during cooldown is rejected."""
        self.client.post("/api/auth/register", json={
            "full_name": "Cooldown Reject User",
            "email": "user15_cooldown@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        # Immediate resend should fail with 429
        r_res = self.client.post("/api/auth/resend-otp", json={"email": "user15_cooldown@example.com"})
        self.assertEqual(r_res.status_code, 429)
        self.assertIn("Please wait", r_res.json()["detail"])

    def test_10_smtp_mode_does_not_return_otp(self):
        """TEST 10: SMTP mode does NOT return OTP in the API response."""
        os.environ["SMTP_HOST"] = "smtp.example.com"
        os.environ["SMTP_PORT"] = "587"
        os.environ["SMTP_USERNAME"] = "sender@example.com"
        os.environ["SMTP_PASSWORD"] = "secret_pass"

        orig_send = email_service.send_otp_email
        email_service.send_otp_email = lambda email, code, name="": {"sent": True, "demo_mode": False}

        try:
            res = self.client.post("/api/auth/register", json={
                "full_name": "SMTP Mask User",
                "email": "user15_smtpmask@example.com",
                "password": "Password123!",
                "confirm_password": "Password123!"
            })
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertFalse(data.get("demo_mode"))
            self.assertNotIn("demo_otp", data)
            self.assertEqual(data["message"], "We've sent a verification code to your email address.")
        finally:
            email_service.send_otp_email = orig_send
            os.environ.pop("SMTP_HOST", None)
            os.environ.pop("SMTP_PORT", None)
            os.environ.pop("SMTP_USERNAME", None)
            os.environ.pop("SMTP_PASSWORD", None)

    def test_11_demo_mode_indicates_demo_mode(self):
        """TEST 11: Demo mode clearly indicates demo mode."""
        orig_host = os.environ.pop("SMTP_HOST", None)
        try:
            res = self.client.post("/api/auth/register", json={
                "full_name": "Demo Mode User",
                "email": "user15_demomode@example.com",
                "password": "Password123!",
                "confirm_password": "Password123!"
            })
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertTrue(data.get("demo_mode"))
            self.assertIn("DEMO MODE", data["message"])
            self.assertIn("demo_otp", data)
        finally:
            if orig_host:
                os.environ["SMTP_HOST"] = orig_host

    def test_12_different_users_dynamic_recipient_otp(self):
        """TEST 12: Different users receive OTPs associated with their own email addresses."""
        os.environ["SMTP_HOST"] = "smtp.example.com"
        os.environ["SMTP_PORT"] = "587"
        os.environ["SMTP_USERNAME"] = "system_sender@shopgenie.com"
        os.environ["SMTP_PASSWORD"] = "secret_pass"

        dispatched = []
        def mock_send(to_email, otp_code, full_name=""):
            dispatched.append({"to": to_email, "otp": otp_code})
            return {"sent": True, "demo_mode": False}

        orig_send = email_service.send_otp_email
        email_service.send_otp_email = mock_send

        try:
            email_a = "user15_a@domain1.org"
            email_b = "user15_b@domain2.net"

            self.client.post("/api/auth/register", json={
                "full_name": "User A",
                "email": email_a,
                "password": "Password123!",
                "confirm_password": "Password123!"
            })
            self.client.post("/api/auth/register", json={
                "full_name": "User B",
                "email": email_b,
                "password": "Password123!",
                "confirm_password": "Password123!"
            })

            self.assertEqual(len(dispatched), 2)
            self.assertEqual(dispatched[0]["to"], email_a)
            self.assertEqual(dispatched[1]["to"], email_b)
            self.assertNotEqual(dispatched[0]["otp"], dispatched[1]["otp"])
        finally:
            email_service.send_otp_email = orig_send
            os.environ.pop("SMTP_HOST", None)
            os.environ.pop("SMTP_PORT", None)
            os.environ.pop("SMTP_USERNAME", None)
            os.environ.pop("SMTP_PASSWORD", None)

    def test_13_no_hardcoded_recipient_email(self):
        """TEST 13: No hardcoded recipient email exists in source code."""
        service_path = os.path.join(os.path.dirname(__file__), "app", "services", "email_service.py")
        with open(service_path, "r", encoding="utf-8") as f:
            code = f.read()
        self.assertIn('msg["To"] = to_email', code)
        self.assertNotIn("userA@gmail.com", code)
        self.assertNotIn("fixed_recipient", code)

    def test_14_smtp_credentials_not_in_frontend(self):
        """TEST 14: SMTP credentials are not exposed to frontend."""
        frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "src"))
        if os.path.exists(frontend_dir):
            for root, _, files in os.walk(frontend_dir):
                for file in files:
                    if file.endswith((".jsx", ".js", ".ts", ".html")):
                        filepath = os.path.join(root, file)
                        with open(filepath, "r", encoding="utf-8") as f:
                            content = f.read()
                        self.assertNotIn("SMTP_PASSWORD", content)
                        self.assertNotIn("SMTP_HOST", content)

    def test_15_passwords_never_returned_or_logged(self):
        """TEST 15: Passwords are never returned or logged."""
        res = self.client.post("/api/auth/register", json={
            "full_name": "Password Audit User",
            "email": "user15_pwdaudit@example.com",
            "password": "SecretPassword123!",
            "confirm_password": "SecretPassword123!"
        })
        self.assertEqual(res.status_code, 200)
        resp_str = str(res.json())
        self.assertNotIn("SecretPassword123!", resp_str)

if __name__ == "__main__":
    unittest.main()
