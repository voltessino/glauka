/*!
 * Lucide Icons: attribution and licensing retained in distributed offline bundle.
 * ISC License
 * 
 * Copyright (c) 2026 Lucide Icons and Contributors
 * 
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 * 
 * ---
 * 
 * The following Lucide icons are derived from the Feather project:
 * 
 * airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out
 * 
 * The MIT License (MIT) (for the icons listed above)
 * 
 * Copyright (c) 2013-present Cole Bemis
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 */
/* Offline curated expansion based on Health Icons (CC0 1.0).
 * Each category file registers vector paths locally before this module loads.
 * Project files store only an ID and bounded size; paths never enter a map.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GlaukaObjectGalleryPack=api;
})(globalThis,function(root){
  'use strict';
  const categories={
    anatomy:'#e59caa',
    medical:'#7ac6ed',
    objects:'#f1bd7f',
    food:'#91c58d',
    movement:'#f6aa80',
    ideas:'#b09df5',
    places:'#84b9cb',work:'#b09df5',technology:'#7ac6ed'
  };
  const names=['anatomy-a','anatomy-b','anatomy-c','medical-a','medical-b',
    'objects-a','objects-b','food','movement','ideas-a','ideas-b','places','work','glauka','lucide-a','lucide-b','lucide-c','lucide-d','lucide-e','lucide-f','lucide-g','lucide-h','lucide-i','lucide-j','lucide-k','lucide-l','lucide-m','lucide-n','lucide-o','lucide-p','lucide-q','lucide-r','lucide-s','lucide-t','lucide-u'];
  const entries=typeof module==='object'&&module.exports&&typeof require==='function'
    ? names.flatMap(name=>require('./object-gallery-parts-'+name+'.js'))
    : (root.GlaukaObjectGalleryParts||[]);
  const catalogue=new Map();
  for(const item of entries){
    if(!item||typeof item!=='object'||!categories[item.category]||
       !/^[a-z][a-z0-9-]{1,45}$/.test(item.id)||
       !/^[a-z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(item.source)||
       typeof item.body!=='string'||item.body.length>18000||
       !/<(?:path|circle|rect|polygon|ellipse|g)\b/.test(item.body)||
       /<script|<image|<foreignObject|onload=|javascript:|https?:\/\//i.test(item.body)||
       catalogue.has(item.id))continue;
    catalogue.set(item.id,item);
  }
  const ITEMS=Object.freeze([...catalogue.values()].map(item=>Object.freeze({
    id:item.id,it:String(item.it).slice(0,64),en:String(item.en).slice(0,64),
    category:item.category,source:item.source,
    keywords:typeof item.keywords==='string'?item.keywords.slice(0,160):''
  })));
  function body(id){
    const asset=catalogue.get(id);
    if(!asset)return '';
    const accent=categories[asset.category];
    return '<circle cx="120" cy="118" r="101" fill="none" stroke="'+accent+
      '" stroke-opacity=".27" stroke-width="1.5"/>'+
      '<circle cx="120" cy="118" r="84" fill="url(#nm-med-halo)" opacity=".65"/>'+
      '<g transform="translate(15 15) scale(4.375)">'+asset.body+'</g>';
  }
  return {ITEMS,body,CATEGORIES:Object.freeze(Object.keys(categories))};
});
