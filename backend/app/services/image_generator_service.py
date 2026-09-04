import os
import json
import logging
import datetime
from typing import Any, Dict, Optional

logger = logging.getLogger("reviveai.image_generator")

# Dynamic Prompt Generator
def build_ai_product_image_prompt(product: Dict[str, Any]) -> str:
    """
    Generates a professional, brand-safe, studio ecommerce prompt for any product.
    Enforces isolated clean background, soft lighting, 1:1 aspect ratio, no watermarks.
    """
    name = product.get("name", "Electrical Product")
    category = product.get("category", "Electrical")
    subcategory = product.get("subcategory", "")
    description = product.get("description", "")
    specs = product.get("specs", {})
    specs_str = ", ".join([f"{k}: {v}" for k, v in list(specs.items())[:3]]) if isinstance(specs, dict) else ""

    scene_descriptions = {
        "Lighting": "realistic household lighting fixture, illuminated frosted glass, premium metallic base, crisp studio lighting",
        "Fans & Cooling": "aerodynamic modern ceiling or table fan, high quality motor housing, balanced blades, neutral studio backdrop",
        "Power & Cables": "heavy-duty certified electrical cables, pristine copper and insulated materials, neatly arranged on neutral background",
        "Switches & Wiring": "sleek modular switchboard and electrical components, clean polycarbonate faceplate, safety shutters, architectural photography",
        "Kitchen Appliances": "sleek modern kitchen appliance, brushed stainless steel and durable matte finish, studio tabletop lighting",
        "Inverters & Heavy Power": "heavy-duty power inverter and backup equipment, digital LCD indicator screen, robust industrial finish",
        "Laptops & Computers": "ultra-slim precision enterprise laptop computer, open display showing crisp screen, backlit keyboard, anodized aluminum chassis",
        "Computer Accessories": "premium computer accessory, ergonomic matte finish, high-speed connectivity accents, clean ecommerce studio shot",
    }
    scene = scene_descriptions.get(category, "professional electronic product isolated on clean neutral studio background")

    prompt = (
        f"A professional ecommerce product photograph of {name}. "
        f"Category: {category} ({subcategory}). "
        f"Product details: {description}. {specs_str}. "
        f"Style: {scene}, centered in frame, isolated on clean neutral white/light-gray background, "
        f"1:1 square composition, soft studio lighting, ultra-sharp focus, realistic materials and proportions, "
        f"commercial product photography, no people, no watermark, no text artifacts."
    )
    return prompt


def get_product_svg_artwork(product: Dict[str, Any]) -> str:
    """
    Generates high-fidelity SVG artwork for all 56 catalog products.
    Creates rich gradients, highlights, accurate product silhouettes and components.
    """
    p_id = product.get("id", "")
    name = product.get("name", "Product")
    category = product.get("category", "Electrical")
    subcategory = product.get("subcategory", "")

    short_title = name.split("(")[0].strip()[:35]

    theme_colors = {
        "Lighting": {"primary": "#F59E0B", "accent": "#FEF08A", "glow": "rgba(245, 158, 11, 0.25)"},
        "Fans & Cooling": {"primary": "#06B6D4", "accent": "#67E8F9", "glow": "rgba(6, 182, 212, 0.25)"},
        "Power & Cables": {"primary": "#3B82F6", "accent": "#93C5FD", "glow": "rgba(59, 130, 246, 0.25)"},
        "Switches & Wiring": {"primary": "#8B5CF6", "accent": "#C4B5FD", "glow": "rgba(139, 92, 246, 0.25)"},
        "Kitchen Appliances": {"primary": "#EF4444", "accent": "#FCA5A5", "glow": "rgba(239, 68, 68, 0.25)"},
        "Inverters & Heavy Power": {"primary": "#10B981", "accent": "#6EE7B7", "glow": "rgba(16, 185, 129, 0.25)"},
        "Laptops & Computers": {"primary": "#6366F1", "accent": "#A5B4FC", "glow": "rgba(99, 102, 241, 0.25)"},
        "Computer Accessories": {"primary": "#EC4899", "accent": "#F472B6", "glow": "rgba(236, 72, 153, 0.25)"},
    }
    theme = theme_colors.get(category, {"primary": "#F59E0B", "accent": "#FEF08A", "glow": "rgba(245, 158, 11, 0.25)"})

    if "bulb" in p_id or "lamp" in p_id:
        product_art = f'''
        <circle cx="250" cy="190" r="110" fill="{theme['glow']}" filter="blur(20px)" />
        <path d="M 180 190 C 180 125 210 95 250 95 C 290 95 320 125 320 190 C 320 225 295 245 285 270 L 215 270 C 205 245 180 225 180 190 Z" 
              fill="url(#bulbDomeGrad)" stroke="#E2E8F0" stroke-width="2" />
        <circle cx="250" cy="180" r="35" fill="{theme['accent']}" opacity="0.8" filter="blur(8px)" />
        <ellipse cx="250" cy="180" rx="18" ry="24" fill="#FFFFFF" opacity="0.9" />
        <path d="M 210 270 L 290 270 L 285 305 L 215 305 Z" fill="url(#heatsinkGrad)" stroke="#CBD5E1" stroke-width="1.5" />
        <line x1="220" y1="280" x2="280" y2="280" stroke="#94A3B8" stroke-width="2" />
        <line x1="222" y1="292" x2="278" y2="292" stroke="#94A3B8" stroke-width="2" />
        <path d="M 218 305 L 282 305 L 280 340 L 220 340 Z" fill="url(#metallicCapGrad)" stroke="#64748B" stroke-width="1.5" />
        <line x1="220" y1="318" x2="280" y2="318" stroke="#475569" stroke-width="2" />
        <line x1="222" y1="330" x2="278" y2="330" stroke="#475569" stroke-width="2" />
        <circle cx="216" cy="320" r="3" fill="#64748B" />
        <circle cx="284" cy="320" r="3" fill="#64748B" />
        <path d="M 235 340 L 265 340 L 258 352 L 242 352 Z" fill="#334155" />
        '''
    elif "tube" in p_id or "emergency" in p_id:
        product_art = f'''
        <rect x="70" y="210" width="360" height="60" rx="30" fill="{theme['glow']}" filter="blur(16px)" />
        <rect x="80" y="220" width="340" height="40" rx="20" fill="url(#tubeGrad)" stroke="#E2E8F0" stroke-width="2" />
        <rect x="110" y="232" width="280" height="16" rx="8" fill="#FFFFFF" opacity="0.95" />
        <rect x="75" y="218" width="25" height="44" rx="6" fill="#64748B" />
        <rect x="400" y="218" width="25" height="44" rx="6" fill="#64748B" />
        <rect x="140" y="205" width="16" height="14" rx="2" fill="#94A3B8" />
        <rect x="344" y="205" width="16" height="14" rx="2" fill="#94A3B8" />
        '''
    elif "fan" in p_id:
        product_art = f'''
        <circle cx="250" cy="240" r="70" fill="{theme['glow']}" filter="blur(14px)" />
        <rect x="244" y="90" width="12" height="90" rx="3" fill="#475569" />
        <circle cx="250" cy="90" r="14" fill="#334155" />
        <ellipse cx="250" cy="165" rx="30" ry="15" fill="url(#fanBodyGrad)" stroke="#334155" />
        <path d="M 230 230 L 70 170 C 60 165 70 150 90 155 L 225 210 Z" fill="url(#bladeGrad)" stroke="#334155" stroke-width="1.5" />
        <path d="M 270 230 L 430 170 C 440 165 430 150 410 155 L 275 210 Z" fill="url(#bladeGrad)" stroke="#334155" stroke-width="1.5" />
        <path d="M 250 260 L 250 390 C 250 405 235 405 235 385 L 240 260 Z" fill="url(#bladeGrad)" stroke="#334155" stroke-width="1.5" />
        <circle cx="250" cy="235" r="45" fill="url(#fanBodyGrad)" stroke="#1E293B" stroke-width="3" />
        <circle cx="250" cy="235" r="28" fill="{theme['primary']}" opacity="0.3" />
        <circle cx="250" cy="235" r="16" fill="#F8FAFC" stroke="#94A3B8" stroke-width="2" />
        '''
    elif "laptop" in p_id:
        product_art = f'''
        <rect x="120" y="110" width="260" height="170" rx="10" fill="{theme['glow']}" filter="blur(20px)" />
        <rect x="110" y="100" width="280" height="185" rx="12" fill="#0F172A" stroke="#475569" stroke-width="2.5" />
        <rect x="122" y="112" width="256" height="160" rx="6" fill="url(#laptopScreenGrad)" />
        <circle cx="250" cy="106" r="2.5" fill="#38BDF8" />
        <circle cx="250" cy="180" r="30" fill="{theme['primary']}" opacity="0.4" filter="blur(6px)" />
        <path d="M 150 240 Q 250 170 350 220" stroke="{theme['accent']}" stroke-width="3" fill="none" opacity="0.8" />
        <polygon points="70,335 430,335 400,285 100,285" fill="url(#laptopBaseGrad)" stroke="#334155" stroke-width="2" />
        <polygon points="125,310 375,310 365,290 135,290" fill="#0F172A" opacity="0.8" />
        <polygon points="220,330 280,330 276,315 224,315" fill="#334155" />
        <rect x="70" y="335" width="360" height="8" rx="4" fill="#475569" />
        '''
    elif "wire" in p_id or "cable" in p_id or "cord" in p_id:
        product_art = f'''
        <ellipse cx="250" cy="240" rx="140" ry="80" fill="{theme['glow']}" filter="blur(16px)" />
        <ellipse cx="250" cy="240" rx="130" ry="70" fill="none" stroke="url(#cableGrad1)" stroke-width="22" />
        <ellipse cx="250" cy="235" rx="110" ry="58" fill="none" stroke="url(#cableGrad2)" stroke-width="20" />
        <ellipse cx="250" cy="230" rx="90" ry="46" fill="none" stroke="url(#cableGrad1)" stroke-width="18" />
        <ellipse cx="250" cy="225" rx="55" ry="28" fill="#1E293B" stroke="#475569" stroke-width="3" />
        <path d="M 330 190 Q 370 160 390 130" fill="none" stroke="{theme['primary']}" stroke-width="12" stroke-linecap="round" />
        <line x1="390" y1="130" x2="410" y2="105" stroke="#F59E0B" stroke-width="6" stroke-linecap="round" />
        <line x1="390" y1="130" x2="415" y2="115" stroke="#EA580C" stroke-width="5" stroke-linecap="round" />
        '''
    elif "switch" in p_id or "socket" in p_id or "mcb" in p_id or "dist" in p_id:
        product_art = f'''
        <rect x="130" y="110" width="240" height="240" rx="24" fill="{theme['glow']}" filter="blur(16px)" />
        <rect x="135" y="115" width="230" height="230" rx="20" fill="url(#plateGrad)" stroke="#CBD5E1" stroke-width="3" />
        <rect x="160" y="140" width="180" height="180" rx="12" fill="#F8FAFC" stroke="#94A3B8" stroke-width="2" />
        <rect x="180" y="160" width="60" height="100" rx="8" fill="url(#rockerGrad)" stroke="#64748B" stroke-width="1.5" />
        <line x1="210" y1="175" x2="210" y2="195" stroke="#94A3B8" stroke-width="3" stroke-linecap="round" />
        <circle cx="210" cy="245" r="4" fill="{theme['primary']}" />
        <rect x="260" y="160" width="60" height="100" rx="8" fill="url(#rockerGrad)" stroke="#64748B" stroke-width="1.5" />
        <circle cx="290" cy="185" r="7" fill="#1E293B" />
        <circle cx="280" cy="225" r="5" fill="#1E293B" />
        <circle cx="300" cy="225" r="5" fill="#1E293B" />
        <rect x="190" y="285" width="120" height="16" rx="4" fill="#F1F5F9" />
        <line x1="200" y1="293" x2="300" y2="293" stroke="{theme['primary']}" stroke-width="2" />
        '''
    elif "kettle" in p_id or "mixer" in p_id or "stove" in p_id or "toaster" in p_id:
        product_art = f'''
        <ellipse cx="250" cy="250" rx="110" ry="110" fill="{theme['glow']}" filter="blur(18px)" />
        <path d="M 190 320 C 170 310 165 200 200 170 L 300 170 C 335 200 330 310 310 320 Z" 
              fill="url(#kettleGrad)" stroke="#64748B" stroke-width="2" />
        <path d="M 180 200 L 140 180 L 175 240 Z" fill="#94A3B8" stroke="#475569" stroke-width="1.5" />
        <path d="M 305 180 C 370 190 370 290 315 310" fill="none" stroke="#1E293B" stroke-width="18" stroke-linecap="round" />
        <ellipse cx="250" cy="170" rx="55" ry="16" fill="#334155" />
        <circle cx="250" cy="148" r="12" fill="#0F172A" />
        <ellipse cx="250" cy="330" rx="80" ry="20" fill="#1E293B" stroke="#475569" stroke-width="2" />
        <circle cx="250" cy="305" r="4" fill="{theme['primary']}" />
        '''
    elif "inverter" in p_id or "battery" in p_id or "ups" in p_id or "stabilizer" in p_id:
        product_art = f'''
        <rect x="110" y="130" width="280" height="200" rx="16" fill="{theme['glow']}" filter="blur(16px)" />
        <rect x="115" y="135" width="270" height="190" rx="14" fill="url(#inverterGrad)" stroke="#334155" stroke-width="3" />
        <rect x="140" y="155" width="220" height="85" rx="8" fill="#020617" stroke="#1E293B" stroke-width="2" />
        <text x="155" y="185" fill="#38BDF8" font-family="monospace" font-size="16" font-weight="bold">PURE SINE WAVE</text>
        <text x="155" y="215" fill="{theme['primary']}" font-family="monospace" font-size="22" font-weight="bold">230V • 100%</text>
        <line x1="140" y1="265" x2="360" y2="265" stroke="#475569" stroke-width="3" stroke-linecap="round" />
        <line x1="140" y1="280" x2="360" y2="280" stroke="#475569" stroke-width="3" stroke-linecap="round" />
        <line x1="140" y1="295" x2="360" y2="295" stroke="#475569" stroke-width="3" stroke-linecap="round" />
        <circle cx="340" cy="200" r="10" fill="{theme['primary']}" opacity="0.9" />
        '''
    else:
        product_art = f'''
        <ellipse cx="250" cy="240" rx="110" ry="110" fill="{theme['glow']}" filter="blur(16px)" />
        <path d="M 190 320 C 160 270 160 180 200 140 C 230 110 270 110 300 140 C 340 180 340 270 310 320 C 280 350 220 350 190 320 Z" 
              fill="url(#accGrad)" stroke="#475569" stroke-width="2.5" />
        <rect x="242" y="150" width="16" height="40" rx="8" fill="#0F172A" stroke="#64748B" stroke-width="1.5" />
        <line x1="250" y1="160" x2="250" y2="180" stroke="{theme['primary']}" stroke-width="2" />
        <path d="M 175 220 Q 185 270 200 300" fill="none" stroke="{theme['primary']}" stroke-width="3" stroke-linecap="round" />
        <circle cx="250" cy="270" r="14" fill="{theme['primary']}" opacity="0.3" filter="blur(4px)" />
        <polygon points="250,260 258,276 242,276" fill="#F8FAFC" />
        '''

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="60%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#020617" />
    </radialGradient>
    <linearGradient id="bulbDomeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="50%" stop-color="#F8FAFC" />
      <stop offset="100%" stop-color="#E2E8F0" />
    </linearGradient>
    <linearGradient id="heatsinkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#E2E8F0" />
      <stop offset="50%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#CBD5E1" />
    </linearGradient>
    <linearGradient id="metallicCapGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#94A3B8" />
      <stop offset="50%" stop-color="#F1F5F9" />
      <stop offset="100%" stop-color="#64748B" />
    </linearGradient>
    <linearGradient id="tubeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#E2E8F0" />
    </linearGradient>
    <linearGradient id="fanBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#475569" />
      <stop offset="50%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
    <linearGradient id="bladeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#64748B" />
      <stop offset="100%" stop-color="#334155" />
    </linearGradient>
    <linearGradient id="laptopScreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284C7" />
      <stop offset="50%" stop-color="#3B82F6" />
      <stop offset="100%" stop-color="#1D4ED8" />
    </linearGradient>
    <linearGradient id="laptopBaseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#334155" />
      <stop offset="50%" stop-color="#64748B" />
      <stop offset="100%" stop-color="#1E293B" />
    </linearGradient>
    <linearGradient id="cableGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{theme['primary']}" />
      <stop offset="100%" stop-color="{theme['accent']}" />
    </linearGradient>
    <linearGradient id="cableGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{theme['accent']}" />
      <stop offset="100%" stop-color="{theme['primary']}" />
    </linearGradient>
    <linearGradient id="plateGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F1F5F9" />
    </linearGradient>
    <linearGradient id="rockerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#E2E8F0" />
    </linearGradient>
    <linearGradient id="kettleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#94A3B8" />
      <stop offset="35%" stop-color="#FFFFFF" />
      <stop offset="70%" stop-color="#CBD5E1" />
      <stop offset="100%" stop-color="#64748B" />
    </linearGradient>
    <linearGradient id="inverterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#334155" />
      <stop offset="50%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
    <linearGradient id="accGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#334155" />
      <stop offset="50%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
  </defs>

  <rect width="500" height="500" rx="28" fill="url(#bgGrad)" />
  <ellipse cx="250" cy="420" rx="160" ry="30" fill="#000000" opacity="0.45" filter="blur(14px)" />

  <g opacity="0.06">
    <line x1="50" y1="0" x2="50" y2="500" stroke="#FFFFFF" stroke-dasharray="4,4" />
    <line x1="150" y1="0" x2="150" y2="500" stroke="#FFFFFF" stroke-dasharray="4,4" />
    <line x1="250" y1="0" x2="250" y2="500" stroke="#FFFFFF" stroke-dasharray="4,4" />
    <line x1="350" y1="0" x2="350" y2="500" stroke="#FFFFFF" stroke-dasharray="4,4" />
    <line x1="450" y1="0" x2="450" y2="500" stroke="#FFFFFF" stroke-dasharray="4,4" />
    <line x1="0" y1="100" x2="500" y2="100" stroke="#FFFFFF" stroke-dasharray="4,4" />
    <line x1="0" y1="200" x2="500" y2="200" stroke="#FFFFFF" stroke-dasharray="4,4" />
    <line x1="0" y1="300" x2="500" y2="300" stroke="#FFFFFF" stroke-dasharray="4,4" />
    <line x1="0" y1="400" x2="500" y2="400" stroke="#FFFFFF" stroke-dasharray="4,4" />
  </g>

  {product_art}

  <g transform="translate(360, 24)">
    <rect width="116" height="26" rx="8" fill="#0F172A" stroke="{theme['primary']}" stroke-width="1" opacity="0.9" />
    <text x="58" y="17" fill="{theme['primary']}" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" text-anchor="middle">
      {category.upper()[:14]}
    </text>
  </g>

  <g transform="translate(24, 436)">
    <rect width="452" height="40" rx="12" fill="#0F172A" stroke="#334155" stroke-width="1.2" opacity="0.95" />
    <circle cx="20" cy="20" r="6" fill="{theme['primary']}" />
    <text x="34" y="24" fill="#F8FAFC" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700">
      {short_title}
    </text>
  </g>
</svg>'''
    return svg_content.strip()


def generate_and_save_catalog_images(output_dirs: list[str]) -> int:
    """
    Generates all 56 catalog product SVGs and saves them to frontend public directories.
    """
    from app.services.product_service import CATALOG_ITEMS

    count = 0
    for out_dir in output_dirs:
        os.makedirs(out_dir, exist_ok=True)
        for prod in CATALOG_ITEMS:
            p_id = prod["id"]
            svg_str = get_product_svg_artwork(prod)
            file_path = os.path.join(out_dir, f"{p_id}.svg")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(svg_str)
            count += 1
            
    logger.info(f"Successfully generated and saved {count} product images.")
    return count
