    const THEME_PALETTES = {
      prisma: ['#6441df','#a050ba','#237b83','#d57844','#4b69b8','#a34469','#577343'],
      default: [
        '#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
        '#ec4899', '#3b82f6', '#84cc16', '#f97316', '#14b8a6'
      ],
      neon: [
        '#00f5d4', '#7b2cbf', '#ff007f', '#00bbf9', '#fee440',
        '#f15bb5', '#00f5d4', '#9b5de5', '#00bbf9', '#ff007f'
      ],
      forest: [
        '#10b981', '#84cc16', '#14b8a6', '#eab308', '#22c55e',
        '#059669', '#65a30d', '#0d9488', '#ca8a04', '#4ade80'
      ],
      sunset: [
        '#f43f5e', '#f97316', '#eab308', '#ec4899', '#fb7185',
        '#fb923c', '#facc15', '#f472b6', '#e11d48', '#ea580c'
      ],
      ocean: [
        '#38bdf8', '#6366f1', '#06b6d4', '#8b5cf6', '#0ea5e9',
        '#3b82f6', '#22d3ee', '#a855f7', '#0284c7', '#4f46e5'
      ]
    };

    globalThis.NeuroMapEditorPalettes = THEME_PALETTES;
    const HARMONIC_PALETTE = [...THEME_PALETTES.default];
    const imageCache = new Map();
    // Bound decoded rasters for long sessions on one open tab. Closing a map
    // still uses releaseClosedRasterImages; this only caps growth while the
    // same tab keeps importing distinct images. Prefer dropping completed
    // entries; force the oldest key only when every cached image is still
    // decoding.
    const IMAGE_CACHE_LIMIT = 96;
    function touchCachedImage(src) {
      if (!imageCache.has(src)) return undefined;
      const value = imageCache.get(src);
      imageCache.delete(src);
      imageCache.set(src, value);
      return value;
    }
    function rememberCachedImage(src, value) {
      if (imageCache.has(src)) imageCache.delete(src);
      imageCache.set(src, value);
      while (imageCache.size > IMAGE_CACHE_LIMIT) {
        let evicted = false;
        for (const [key, entry] of imageCache) {
          if (entry && entry.complete === false) continue;
          imageCache.delete(key);
          evicted = true;
          break;
        }
        if (!evicted) imageCache.delete(imageCache.keys().next().value);
      }
      return value;
    }

    class ColorUtils {
      // Raster sources from a closed map only; keep all references in open maps.
      // Do not touch SVG/artwork, remote URLs, source data or pending Image loads.
      static releaseClosedRasterImages(candidates, retained) {
        const keep=new Set(retained);let released=0;
        for(const src of candidates){
          if(typeof src==='string'&&/^data:image\/(?:png|jpe?g|gif|webp|bmp)(?:;|,)/i.test(src)&&!keep.has(src))
            if(imageCache.delete(src))released++;
        }
        return released;
      }

      static hexToRgb(hex) {
        const clean = String(hex || '#6366f1').replace('#', '');
        const num = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
        return {
          r: (num >> 16) & 255,
          g: (num >> 8) & 255,
          b: num & 255
        };
      }

      static lighten(hex, percent) {
        const { r, g, b } = ColorUtils.hexToRgb(hex);
        const amt = Math.round(2.55 * percent);
        const nr = Math.min(255, Math.max(0, r + amt));
        const ng = Math.min(255, Math.max(0, g + amt));
        const nb = Math.min(255, Math.max(0, b + amt));
        return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
      }

      static rgba(hex, alpha) {
        const { r, g, b } = ColorUtils.hexToRgb(hex);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
