# Proposal: AI-Generated Game Asset Pipeline

**Status:** Reference / Best Practices
**Author:** Development Team
**Date:** 2026-01-24
**Context:** Rust Book Client UI Assets

---

## Executive Summary

This document outlines a cost-effective workflow for generating consistent, high-quality game assets (UI icons, textures, effects) using AI image generation tools. The strategy focuses on rapid style discovery using commercial tools, then training custom models for unlimited local generation.

**Key Strategy:** Use Midjourney for style discovery → Train custom LoRA → Generate locally for free

**ROI:** After ~50-100 assets, total cost ($15-25 one-time) is cheaper than monthly subscriptions

---

## Background: The Challenge

Game development requires dozens to hundreds of consistent assets:
- UI icons (compass, inventory, map, actions)
- Item textures (weapons, potions, equipment)
- Effect overlays (fire, ice, magic, damage)
- Environmental textures (paper, wood, metal)

**Traditional approaches:**
- **Hire artist:** $500-2000 for icon set, slow iteration
- **Asset stores:** Limited customization, licensing concerns
- **DIY in Photoshop:** Requires artistic skill, time-intensive

**AI generation challenges:**
- Style consistency across multiple assets
- Iteration speed vs quality trade-offs
- Cloud service costs for large asset libraries
- Technical learning curve for local tools

---

## The Recommended Workflow

### Phase 1: Style Discovery (Midjourney)

**Tool:** Midjourney (Discord-based)
**Cost:** $10/month (Basic plan)
**Duration:** 1-7 days
**Output:** 15-20 training images in consistent style

#### Process

```
1. Rapid Style Exploration
   /imagine whimsical game icon, compass rose --sref random --v 6

   Generate 10-20 variations with different --sref codes
   Identify the style that matches your vision

2. Lock in Style Reference
   Once you find a style you love:
   /imagine whimsical compass icon --sref 2847593021

   Note the --sref code (e.g., 2847593021)
   This becomes your "style ID"

3. Generate Training Set
   Create 15-20 diverse assets in same style:

   /imagine compass rose icon --sref 2847593021
   /imagine health potion icon --sref 2847593021
   /imagine sword icon --sref 2847593021
   /imagine shield icon --sref 2847593021
   /imagine map icon --sref 2847593021
   /imagine inventory bag icon --sref 2847593021
   ... (15-20 total)

4. Upscale & Download
   - Upscale each to highest resolution (2048x2048)
   - Download all images
   - Organize in training_data/ folder
```

#### Training Set Guidelines

| Aspect | Recommendation | Why |
|--------|----------------|-----|
| **Quantity** | 15-20 images (min) | Enough variety without overfitting |
| **Diversity** | Different objects (not all compasses) | Teaches style, not specific object |
| **Consistency** | Same --sref code for all | Ensures unified style |
| **Resolution** | 2048x2048 upscaled | Better LoRA training quality |
| **Backgrounds** | Transparent or consistent | Easier to use in-game |

#### Example Midjourney Prompts

```
Style Discovery Phase:
────────────────────
# Find your aesthetic
/imagine whimsical fantasy game icon, compass rose,
cute style, outlined, pastel colors --sref random --ar 1:1 --v 6

# Try different aesthetics
/imagine dark fantasy game icon, compass rose,
gothic, intricate details --sref random --ar 1:1 --v 6

/imagine minimalist game icon, compass rose,
flat design, clean lines --sref random --ar 1:1 --v 6


Training Set Generation:
────────────────────────
# Once you have your --sref code (example: 2847593021)

/imagine compass rose icon --sref 2847593021 --ar 1:1
/imagine health potion icon, red liquid, glass bottle --sref 2847593021 --ar 1:1
/imagine mana potion icon, blue liquid, crystal vial --sref 2847593021 --ar 1:1
/imagine iron sword icon --sref 2847593021 --ar 1:1
/imagine wooden shield icon --sref 2847593021 --ar 1:1
/imagine treasure map icon, rolled parchment --sref 2847593021 --ar 1:1
/imagine inventory bag icon, leather pouch --sref 2847593021 --ar 1:1
/imagine key icon, ornate brass --sref 2847593021 --ar 1:1
/imagine lock icon, heavy padlock --sref 2847593021 --ar 1:1
/imagine arrow icon --sref 2847593021 --ar 1:1
/imagine bow icon --sref 2847593021 --ar 1:1
/imagine helmet icon --sref 2847593021 --ar 1:1
/imagine boots icon --sref 2847593021 --ar 1:1
/imagine ring icon, magical --sref 2847593021 --ar 1:1
/imagine amulet icon, glowing gem --sref 2847593021 --ar 1:1
```

**Total cost:** $10 for one month of Midjourney

---

### Phase 2: LoRA Training

**What is LoRA?**
LoRA (Low-Rank Adaptation) is a technique to fine-tune Stable Diffusion models on your specific art style without retraining the entire model.

**Analogy for web developers:**
Think of it like creating a CSS theme that applies your visual style to any content. Instead of manually styling each element, you define the style once and apply it everywhere.

#### Option A: Cloud Training (Recommended for Beginners)

**Tool:** Replicate.com or RunDiffusion.com
**Cost:** $5-10 one-time
**Duration:** 1-2 hours (automated)
**Requirements:** None (runs in browser)

**Process:**

```
1. Sign up for Replicate.com
   https://replicate.com

2. Upload Training Images
   - Create ZIP of your 15-20 Midjourney images
   - Upload to Replicate

3. Configure Training
   - Base model: Stable Diffusion 1.5 or SDXL
   - Steps: 1000-2000
   - Learning rate: 1e-4
   - Trigger word: "whimsical_icon_style" (or your choice)

4. Start Training
   - Click "Train"
   - Wait 1-2 hours
   - Receive notification when complete

5. Download LoRA
   - Download .safetensors file
   - Save as: whimsical_icon_style.safetensors
```

**Pros:** Easy, no technical setup, reliable
**Cons:** ~$5-10 cost, requires internet

#### Option B: Local Training (Advanced, Free)

**Tool:** kohya_ss (most popular LoRA trainer)
**Requirements:**
- NVIDIA GPU with 8GB+ VRAM (RTX 3060 or better)
- 50GB disk space
- Python 3.10+

**Setup:**

```bash
# Clone kohya_ss
git clone https://github.com/bmaltais/kohya_ss
cd kohya_ss

# Run setup script
./setup.sh

# Or manual setup:
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Organize Training Data:**

```
training_data/
└─ 15_whimsical_icon_style/
    ├─ compass_001.png
    ├─ potion_002.png
    ├─ sword_003.png
    ├─ shield_004.png
    ├─ map_005.png
    └─ ... (15-20 images)

Note: The "15_" prefix tells kohya to train each image 15 times per epoch
```

**Caption Files (Optional but Recommended):**

```
# Create .txt file for each image with same name
compass_001.txt:
whimsical game icon, compass rose, gold and brass details

potion_002.txt:
whimsical game icon, health potion, red liquid, glass bottle

sword_003.txt:
whimsical game icon, iron sword, medieval weapon
```

**Training Command:**

```bash
# Basic training
python train_network.py \
  --pretrained_model_name_or_path="runwayml/stable-diffusion-v1-5" \
  --train_data_dir="training_data" \
  --output_dir="output_lora" \
  --output_name="whimsical_icon_style" \
  --max_train_steps=2000 \
  --learning_rate=1e-4 \
  --network_dim=64 \
  --network_alpha=32

# For SDXL (higher quality)
python sdxl_train_network.py \
  --pretrained_model_name_or_path="stabilityai/stable-diffusion-xl-base-1.0" \
  --train_data_dir="training_data" \
  --output_dir="output_lora" \
  --output_name="whimsical_icon_style_xl" \
  --max_train_steps=2000 \
  --learning_rate=1e-4
```

**Training time:** 1-3 hours depending on GPU

**Pros:** Free, unlimited retraining, full control
**Cons:** Requires GPU, technical setup, learning curve

---

### Phase 3: Local Generation (Free Forever)

**Tool:** AUTOMATIC1111 Web UI or ComfyUI
**Cost:** $0 (runs locally)
**Requirements:** Same GPU as training (8GB+ VRAM)

#### Setup AUTOMATIC1111

```bash
# Clone repository
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui
cd stable-diffusion-webui

# First run (downloads models)
./webui.sh  # macOS/Linux
# or
webui-user.bat  # Windows

# Install base model if needed
# SD 1.5: runwayml/stable-diffusion-v1-5
# SDXL: stabilityai/stable-diffusion-xl-base-1.0
```

#### Install Your LoRA

```bash
# Copy your trained LoRA to models/Lora/
cp whimsical_icon_style.safetensors \
   stable-diffusion-webui/models/Lora/

# Restart web UI
```

#### Generate Assets

```
1. Open web UI: http://localhost:7860

2. Prompt format:
   treasure chest icon <lora:whimsical_icon_style:0.8>

   The number (0.8) is strength: 0.0-1.0
   - 0.5 = subtle style
   - 0.8 = strong style (recommended)
   - 1.0 = maximum style influence

3. Settings:
   - Width/Height: 512x512 (or 1024x1024 for SDXL)
   - Sampling steps: 20-30
   - Sampler: DPM++ 2M Karras (good default)
   - CFG Scale: 7-8

4. Generate!
   - Click "Generate"
   - Takes 5-20 seconds per image
   - Generate as many as you want (free)
```

#### Example Prompts

```
Navigation Icons:
compass rose icon <lora:whimsical_icon_style:0.8>
map icon, folded parchment <lora:whimsical_icon_style:0.8>
waypoint marker icon <lora:whimsical_icon_style:0.8>

Combat Icons:
crossed swords icon <lora:whimsical_icon_style:0.8>
shield icon, defensive <lora:whimsical_icon_style:0.8>
bow and arrow icon <lora:whimsical_icon_style:0.8>

Inventory Icons:
backpack icon, adventure gear <lora:whimsical_icon_style:0.8>
key icon, ornate bronze <lora:whimsical_icon_style:0.8>
potion bottle icon, magic elixir <lora:whimsical_icon_style:0.8>

UI Elements:
settings gear icon <lora:whimsical_icon_style:0.8>
menu hamburger icon <lora:whimsical_icon_style:0.8>
close X icon <lora:whimsical_icon_style:0.8>
```

---

## Alternative: Leonardo.ai Custom Models

If you want cloud-based generation without local setup:

**Tool:** Leonardo.ai
**Cost:** $12/month (includes custom model training)
**Process:**

```
1. Sign up: https://leonardo.ai

2. Create Custom Model
   - Upload 10-15 training images
   - Name: "Whimsical Game Icons"
   - Training time: ~30 minutes

3. Generate Assets
   - Select your custom model
   - Prompt: "treasure chest icon"
   - Enable "Remove Background" for transparency
   - Generate unlimited with monthly plan

4. Features
   - Built-in background removal
   - Image-to-image guidance
   - Texture generation mode
   - Upscaling included
```

**Pros:** No GPU needed, easier than LoRA, built-in transparency
**Cons:** Ongoing monthly cost, less control than local LoRA

---

## Workflow Comparison

| Approach | Setup Cost | Ongoing Cost | Quality | Control | Best For |
|----------|-----------|--------------|---------|---------|----------|
| **Midjourney only** | $10/mo | $10-60/mo | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Small projects (10-50 assets) |
| **Midjourney → LoRA** | $15-25 one-time | $0 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Large projects (100+ assets) |
| **Leonardo.ai** | $12/mo | $12/mo | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Non-technical teams |
| **SD + LoRA only** | $0 | $0 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Technical, very budget-conscious |

---

## For Book Client: Recommended Path

### Immediate (This Week)

**Use Midjourney for rapid prototyping:**

```
Goal: Get compass + basic UI icons to test rendering
Budget: $10 (one month)

1. Find style with --sref random (1-2 days)
2. Generate 5-10 core icons with that --sref
3. Test in book client
4. Validate visual direction
```

**Output:** Functional prototype with real assets

### Near-Term (Within Month)

**If style is validated, train LoRA:**

```
Goal: Set up unlimited local generation
Budget: $5-10 for cloud training (or free if local GPU)

1. Generate 15-20 training images in Midjourney
2. Train LoRA on Replicate.com
3. Set up AUTOMATIC1111 locally
4. Generate remaining 50-100 icons locally
```

**ROI:** After ~30-40 additional icons, you've saved money vs Midjourney subscription

### Long-Term (Production)

**Maintain LoRA library:**

```
- Keep trained LoRAs versioned (git LFS or DVC)
- Document trigger words and optimal settings
- Create asset generation script for batch creation
- Retrain LoRA if style needs to evolve
```

---

## Post-Processing for Transparency

Most AI tools don't generate perfect transparency. Post-process for game use:

### Quick Method: remove.bg

```
1. Upload generated icon to remove.bg
2. Download PNG with transparency
3. Free for low-res, $0.20/image for high-res
```

### Better Method: GIMP (Free)

```
1. Install GIMP: https://www.gimp.org
2. Open generated image
3. Layer → Transparency → Add Alpha Channel
4. Select → By Color → Click background
5. Edit → Clear (or Delete key)
6. File → Export As → PNG
   - Enable "Save background color" OFF
   - Enable "Save color values from transparent pixels" ON
```

### Batch Processing (Python)

```python
from PIL import Image
from rembg import remove

# Install: pip install rembg pillow

def remove_background(input_path, output_path):
    with open(input_path, 'rb') as i:
        input_img = i.read()
        output_img = remove(input_img)

    img = Image.open(io.BytesIO(output_img))
    img.save(output_path, 'PNG')

# Process all icons
for icon in Path('generated/').glob('*.png'):
    remove_background(icon, f'transparent/{icon.name}')
```

---

## Integration with Bevy

Once you have transparent PNGs:

```rust
// Save to: book-client/assets/textures/icons/
book-client/
└─ assets/
   └─ textures/
      └─ icons/
         ├─ compass_rose.png
         ├─ health_potion.png
         ├─ map.png
         └─ sword.png

// Load in Bevy
fn setup_ui_icons(
    mut commands: Commands,
    asset_server: Res<AssetServer>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    let compass_tex = asset_server.load("textures/icons/compass_rose.png");

    let material = materials.add(StandardMaterial {
        base_color_texture: Some(compass_tex),
        alpha_mode: AlphaMode::Blend,
        unlit: true, // For UI elements
        ..default()
    });

    // Use in mesh...
}
```

---

## Troubleshooting

### LoRA produces inconsistent results

**Symptoms:** Style varies between generations
**Fixes:**
- Lower LoRA strength (try 0.6-0.7 instead of 0.8)
- Add more training images (15 minimum, 30-50 ideal)
- Train for more steps (try 3000-4000)
- Use more consistent captions in training data

### Generated icons have wrong colors

**Symptoms:** Colors don't match training set
**Fixes:**
- Include color in prompt: "compass icon, gold and brass <lora:...>"
- Add negative prompt: "cartoon, anime, wrong colors"
- Adjust CFG scale (try 5-6 for softer adherence)

### Background removal fails

**Symptoms:** Transparent areas have artifacts
**Fixes:**
- Generate on white or black solid background (easier to remove)
- Use GIMP's "Select by Color" with tolerance adjustment
- Manual touch-up for complex edges
- Consider generating on pre-made backgrounds that match game

### LoRA training fails (local)

**Symptoms:** Out of memory errors, crashes
**Fixes:**
- Reduce batch size in training config
- Use gradient checkpointing
- Lower resolution (512x512 instead of 1024x1024)
- Close other GPU-using programs
- Use cloud training instead (Replicate)

---

## Cost Analysis

### Small Project (20 icons)

| Approach | Cost | Time |
|----------|------|------|
| Midjourney | $10/mo | 2-3 hours |
| Midjourney → LoRA | $15 one-time | 1-2 days |
| Leonardo.ai | $12/mo | 2-3 hours |

**Recommendation:** Midjourney (simplest)

### Medium Project (100 icons)

| Approach | Cost | Time |
|----------|------|------|
| Midjourney | $10-30/mo (2-3 months) | 10-15 hours |
| Midjourney → LoRA | $15 one-time | 3-4 days setup, then fast |
| Leonardo.ai | $24-36 (2-3 months) | 10-15 hours |

**Recommendation:** Midjourney → LoRA (best ROI)

### Large Project (500+ icons)

| Approach | Cost | Time |
|----------|------|------|
| Midjourney → LoRA | $15 one-time | 1 week setup, then batch |
| Leonardo.ai | $60+ (6+ months) | Weeks |

**Recommendation:** Midjourney → LoRA (only viable option)

---

## Resources

### AI Image Generation Tools

- **Midjourney:** https://midjourney.com
- **Leonardo.ai:** https://leonardo.ai
- **Stable Diffusion:** https://stability.ai
- **remove.bg:** https://remove.bg

### LoRA Training

- **Replicate (cloud training):** https://replicate.com
- **kohya_ss (local training):** https://github.com/bmaltais/kohya_ss
- **LoRA tutorial:** https://github.com/cloneofsimo/lora

### Local Generation

- **AUTOMATIC1111:** https://github.com/AUTOMATIC1111/stable-diffusion-webui
- **ComfyUI:** https://github.com/comfyanonymous/ComfyUI

### Image Processing

- **GIMP (free Photoshop):** https://www.gimp.org
- **rembg (Python bg removal):** https://github.com/danielgatis/rembg

### Asset Management

- **Git LFS (large files):** https://git-lfs.github.com
- **DVC (data versioning):** https://dvc.org

---

## Next Steps

1. **This week:** Sign up for Midjourney, generate test compass icon
2. **Validate style:** Test rendering in book client
3. **Generate training set:** Create 15-20 icons in chosen style
4. **Train LoRA:** Use Replicate for easy cloud training
5. **Set up local generation:** Install AUTOMATIC1111
6. **Batch generate:** Create full UI icon library

---

## Appendix: Style References for MUD/Fantasy Games

### Whimsical Fantasy
```
Midjourney prompt formula:
whimsical fantasy [object] icon, cute style, outlined,
soft colors, hand-drawn feel, storybook illustration

--sref examples that work well: Use --sref random and look for:
- Soft pastel colors
- Rounded shapes
- Outlined/bordered
- Slight texture/grain
```

### Dark Fantasy
```
Midjourney prompt formula:
dark fantasy [object] icon, gothic, intricate details,
aged metal, weathered, dramatic lighting

--sref examples: Look for:
- Deep shadows
- Metallic/stone textures
- High contrast
- Ornate details
```

### Minimalist/Modern
```
Midjourney prompt formula:
minimalist [object] icon, clean lines, flat design,
simple shapes, limited color palette

--sref examples: Look for:
- Geometric shapes
- Flat colors
- High clarity
- No gradients
```

### Hand-Drawn/Sketch
```
Midjourney prompt formula:
hand-drawn [object] icon, ink sketch, crosshatching,
parchment texture, medieval manuscript style

--sref examples: Look for:
- Line art quality
- Paper texture
- Ink-like rendering
- Organic shapes
```

---

**End of Proposal**
