import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
import dotenv

# Ensure backend/.env is loaded
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    dotenv.load_dotenv(dotenv_path=env_path)
else:
    dotenv.load_dotenv()

logger = logging.getLogger("shopgenie.email")

def is_smtp_configured() -> bool:
    """Checks if required SMTP environment variables are present."""
    if env_path.exists():
        dotenv.load_dotenv(dotenv_path=env_path, override=True)
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_user = os.getenv("SMTP_USERNAME", "").strip()
    smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
    return bool(smtp_host and smtp_user and smtp_pass)

def send_otp_email(to_email: str, otp_code: str, full_name: str = "") -> dict:
    """
    Sends a 6-digit OTP verification code to the target email via SMTP.
    Returns a dict with 'sent' (bool), 'demo_mode' (bool), and optional 'error'.
    NEVER logs credentials or secrets.
    """
    if not is_smtp_configured():
        logger.info(f"[shopgenie][email] SMTP not configured. Operating in DEMO mode for {to_email}")
        return {"sent": False, "demo_mode": True, "reason": "SMTP environment variables not configured."}

    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587").strip())
    smtp_user = os.getenv("SMTP_USERNAME", "").strip()
    smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_from = os.getenv("SMTP_FROM_EMAIL", "").strip() or smtp_user

    greeting = f"Hello {full_name.strip()}," if full_name and full_name.strip() else "Hello,"

    subject = "Verify your ShopGenie account"

    text_content = f"""{greeting}

Your ShopGenie verification code is:

{otp_code}

This code expires in 10 minutes.

If you did not request this verification code, you can safely ignore this email.

Never share your verification code with anyone.

Best regards,
The ShopGenie Team
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify your ShopGenie account</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <h2 style="color: #1a362b; margin-top: 0;">ShopGenie Account Verification</h2>
    <p style="color: #4a5568; font-size: 15px;">{greeting}</p>
    <p style="color: #4a5568; font-size: 15px;">Your ShopGenie verification code is:</p>
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; text-align: center; padding: 16px; margin: 20px 0;">
      <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #166534;">{otp_code}</span>
    </div>
    <p style="color: #4a5568; font-size: 14px; font-weight: 500;">This code expires in 10 minutes.</p>
    <p style="color: #718096; font-size: 13px;">If you did not request this verification code, you can safely ignore this email.</p>
    <p style="color: #dc2626; font-size: 13px; font-weight: 500;">Never share your verification code with anyone.</p>
    <hr style="border: none; border-top: 1px solid #edf2f7; margin: 20px 0;" />
    <p style="color: #a0aec0; font-size: 12px; text-align: center;">&copy; ShopGenie AI Agentic Shopping Assistant</p>
  </div>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_from
    msg["To"] = to_email

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        logger.info(f"[shopgenie][email] Sending OTP email to target {to_email} via SMTP server")
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
            server.starttls()

        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        logger.info(f"[shopgenie][email] OTP email sent successfully to {to_email}")
        return {"sent": True, "demo_mode": False}
    except Exception as e:
        logger.error(f"[shopgenie][email] Failed to send OTP email to {to_email}: {type(e).__name__}")
        return {"sent": False, "demo_mode": False, "error": f"Email delivery failed: {type(e).__name__}"}
