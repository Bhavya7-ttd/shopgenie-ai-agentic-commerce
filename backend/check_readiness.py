import sys
import os
import urllib.request
import re
from concurrent.futures import ThreadPoolExecutor

sys.path.append(os.path.abspath(os.path.dirname(__file__)))
from seed import PRODUCTS_SEED_DATA

def verify_single_url(prod):
    url = prod.get("image_url")
    if not url:
        return (prod["name"], "Missing image_url")
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        req = urllib.request.Request(url, headers=headers, method='HEAD')
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status != 200:
                return (prod["name"], f"HTTP {resp.status}")
    except Exception:
        try:
            req = urllib.request.Request(url, headers=headers, method='GET')
            with urllib.request.urlopen(req, timeout=4) as resp:
                if resp.status != 200:
                    return (prod["name"], f"HTTP {resp.status}")
        except Exception as e2:
            return (prod["name"], str(e2))
    return None

def check_images():
    print("--- 1. Checking Product Image URLs ---")
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(verify_single_url, PRODUCTS_SEED_DATA))
    broken = [r for r in results if r is not None]
    if broken:
        print(f"[FAIL] Found {len(broken)} broken image URLs:")
        for name, err in broken:
            print(f"  - {name}: {err}")
    else:
        print(f"[OK] All {len(PRODUCTS_SEED_DATA)} product image URLs are reachable and valid!")
    return broken

def check_category_counts():
    print("\n--- 2. Checking Category Distribution ---")
    counts = {}
    for p in PRODUCTS_SEED_DATA:
        cat = p["category"]
        counts[cat] = counts.get(cat, 0) + 1
    for cat, count in counts.items():
        print(f"  - {cat}: {count} products")
    return counts

def check_secrets():
    print("\n--- 3. Checking for Hardcoded Secrets ---")
    secrets_found = []
    secret_patterns = [
        r'AIzaSy[A-Za-z0-9_-]{33}',
        r'sk-[A-Za-z0-9]{32,}',
        r'bearer\s+[A-Za-z0-9_\-\.]{20,}'
    ]
    
    root_dir = os.path.dirname(os.path.dirname(__file__))
    for current_root, dirs, files in os.walk(root_dir):
        if 'node_modules' in dirs: dirs.remove('node_modules')
        if '.git' in dirs: dirs.remove('.git')
        if 'venv' in dirs: dirs.remove('venv')
        if '__pycache__' in dirs: dirs.remove('__pycache__')
        
        for f in files:
            if f.endswith(('.py', '.js', '.jsx', '.html', '.json', '.env')):
                filepath = os.path.join(current_root, f)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as file_obj:
                        content = file_obj.read()
                        for pat in secret_patterns:
                            if re.search(pat, content):
                                secrets_found.append((filepath, pat))
                except Exception:
                    pass
    if secrets_found:
        print(f"[FAIL] Found exposed secrets in {len(secrets_found)} files!")
        for fp, pat in secrets_found:
            print(f"  - {fp}")
    else:
        print("[OK] No exposed secrets or hardcoded keys detected!")
    return secrets_found

if __name__ == "__main__":
    check_images()
    check_category_counts()
    check_secrets()
