# OG Image

- Tool: built-in `image_gen` (not the CLI/API fallback).
- Final asset: `public/og-image.png`.
- Dimensions: 1737 x 905 pixels, PNG, approximately 1.92:1.
- Reference: `artifacts/living-city/night-detail.png`, an actual screenshot of the current Three.js renderer.
- Purpose: social sharing artwork only. It is not used as the city terrain or as a substitute for the interactive renderer.
- Original generated output filename: `exec-a4013ae1-e947-45ca-9dc3-dcf44d790427.png` (retained locally).

## Prompt

Use case: ads-marketing. Asset type: Open Graph social sharing image for the existing web project 汐湾 / CITY ATLAS. Create ONE polished wide landscape share cover, ideally 1536 x 800 pixels (approximately 1.91:1). The input is a REFERENCE screenshot of the actual product, not a UI to reproduce. Keep the recognizable low-poly miniature city: pastel small town buildings, curving turquoise river and coastline, arched bridges, green mountains with walking paths, lighthouse, warm streetlights, small boats. Preserve the restrained real low-poly look; do not invent a photorealistic or hyper-detailed product. Remove ALL browser/app UI, settings panel, sliders, buttons, badges, stats, and seed labels. Composition: the city diorama occupies the lower two-thirds and right of a clean landscape composition, a complete readable square board in isometric perspective with clear edge visible; natural clean pale mint background, soft afternoon light with a small amount of warm lamp light, no gradient blobs, no decorative orbs, no picture frame. Typography in the open upper-left area: large elegant dark forest-green Chinese title exactly "汐湾"; directly below in smaller tasteful widely spaced uppercase type exactly "CITY ATLAS"; below that a short clear subtitle exactly "随机生长的三维城市罗盘". No other text. Keep title and city fully inside 6% safe margins, avoid overlap between city and typography, strong legibility at thumbnail size, editorial simplicity with subtle paper texture. Do not include model names or logos or watermarks.

## Validation

The generated title and subtitle were visually checked. The image is copied into the project's public directory; the original output is retained. The browser test decodes the actual PNG and compares its dimensions with the OG metadata.
