import os
import re

frontend_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/lib/fallbackProducts.ts"))
backend_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "../app/services/product_service.py"))

print(f"Reading {frontend_file}")
with open(frontend_file, "r", encoding="utf-8") as f:
    text = f.read()

# Clean up existing image_url and image lines in fallbackProducts.ts
text = re.sub(r'\s*image_url:\s*"[^"]*",?', '', text)
text = re.sub(r'\s*image:\s*"[^"]*",?', '', text)
text = re.sub(r'\s*image_source:\s*"[^"]*",?', '', text)
text = re.sub(r'\s*image_status:\s*"[^"]*",?', '', text)

def repl_frontend(m):
    pid = m.group(1)
    return f'id: "{pid}",\n    image_url: "/products/existing/{pid}.svg",\n    image: "/products/existing/{pid}.svg",\n    image_source: "LOCAL",\n    image_status: "IMAGE_AVAILABLE",'

text = re.sub(r'id:\s*"(prod_[^"]+)",', repl_frontend, text)

with open(frontend_file, "w", encoding="utf-8") as f:
    f.write(text)
print("Updated frontend fallbackProducts.ts")

with open(backend_file, "r", encoding="utf-8") as f:
    btext = f.read()

btext = re.sub(r'\s*"image_url":\s*"[^"]*",?', '', btext)
btext = re.sub(r'\s*"image":\s*"[^"]*",?', '', btext)
btext = re.sub(r'\s*"image_source":\s*"[^"]*",?', '', btext)
btext = re.sub(r'\s*"image_status":\s*"[^"]*",?', '', btext)

def repl_backend(m):
    pid = m.group(1)
    return f'"id": "{pid}",\n        "image_url": "/products/existing/{pid}.svg",\n        "image": "/products/existing/{pid}.svg",\n        "image_source": "LOCAL",\n        "image_status": "IMAGE_AVAILABLE",'

btext = re.sub(r'"id":\s*"(prod_[^"]+)",', repl_backend, btext)

with open(backend_file, "w", encoding="utf-8") as f:
    f.write(btext)
print("Updated backend product_service.py")
