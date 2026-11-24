  // is an SVG drawing, not a low-resolution emoji or externally fetched image.
  const OBJECTS=Object.freeze([
    Object.freeze({id:'scroll',it:'Papiro antico',en:'Antique scroll',category:'heritage'}),
    Object.freeze({id:'amphora',it:'Vaso classico',en:'Classical amphora',category:'heritage'}),
    Object.freeze({id:'frame',it:'Quadro',en:'Framed painting',category:'heritage'}),
    Object.freeze({id:'heart',it:'Cuore',en:'Heart',category:'anatomy'}),
    Object.freeze({id:'lungs',it:'Polmoni',en:'Lungs',category:'anatomy'}),
    Object.freeze({id:'brain',it:'Cervello',en:'Brain',category:'anatomy'}),
    Object.freeze({id:'kidney',it:'Reni',en:'Kidneys',category:'anatomy'}),
    Object.freeze({id:'liver',it:'Fegato',en:'Liver',category:'anatomy'}),
    ...(galleryPack.ITEMS||[]).map(item=>Object.freeze(item))
  ]);
  const artById=new Map(OBJECTS.map(item=>[item.id,item]));
  function objectArt(raw){
    if(!raw||typeof raw!=='object'||!artById.has(raw.id))return null;
    // Strict bounded dimensions: malicious projects may not force huge layouts.
    const n=Number(raw.size);
    return {id:raw.id,size:Number.isFinite(n)?Math.max(64,Math.min(220,Math.round(n))):150};
  }
  const objectSvgCache=new Map();
  function objectSVG(id){
    if(!artById.has(id))return '';
    if(objectSvgCache.has(id))return objectSvgCache.get(id);
    const defs=`<defs>
      <radialGradient id="nm-med-halo"><stop stop-color="#a7bddc" stop-opacity=".25"/><stop offset=".74" stop-color="#84a7cf" stop-opacity=".07"/><stop offset="1" stop-color="#9abbe1" stop-opacity="0"/></radialGradient>
      <linearGradient id="nm-oa-paper" x2="1" y2="1"><stop stop-color="#fff5d4"/><stop offset=".48" stop-color="#e9c780"/><stop offset="1" stop-color="#b7894f"/></linearGradient>
      <linearGradient id="nm-oa-wood"><stop stop-color="#80512e"/><stop offset=".33" stop-color="#ffe4a6"/><stop offset=".67" stop-color="#b78645"/><stop offset="1" stop-color="#6c3e2b"/></linearGradient>
      <linearGradient id="nm-oa-clay" x2="1" y2="1"><stop stop-color="#ffd6a9"/><stop offset=".27" stop-color="#d58d5a"/><stop offset=".68" stop-color="#9d4a39"/><stop offset="1" stop-color="#563246"/></linearGradient>
      <linearGradient id="nm-oa-gold" x2="1" y2="1"><stop stop-color="#fff0af"/><stop offset=".26" stop-color="#e4bd70"/><stop offset=".57" stop-color="#95632c"/><stop offset=".8" stop-color="#e7c483"/><stop offset="1" stop-color="#754829"/></linearGradient>
      <linearGradient id="nm-oa-sky" x2="1" y2="1"><stop stop-color="#75b5ad"/><stop offset=".59" stop-color="#315a7c"/><stop offset="1" stop-color="#25344e"/></linearGradient>
    </defs>`;
    const anatomyBodies={
      'heart':`<circle cx="120" cy="118" r="101" fill="url(#nm-med-halo)" opacity=".49"/><circle cx="120" cy="118" r="94" fill="none" stroke="#8eabd3" stroke-opacity=".24" stroke-width="1.3"/><circle cx="120" cy="118" r="77" fill="none" stroke="#8eabd3" stroke-opacity=".08" stroke-width="1.2"/><path d="M120 11v9m0 196v9M13 118h9m196 0h9" stroke="#b2c9e7" stroke-opacity=".4" stroke-width="1.5"/>
        <g transform="translate(15 15) scale(4.375)">
        <path d="M20.0003 6H24.0003V8.64383C25.2726 8.56635 26.5058 8.64043 27.6139 8.87435C22.9135 10.7244 20.7509 15.4788 20.3968 16.2574L20.375 16.3051C19.2264 16.1307 17.982 15.9857 16.8045 15.9965C15.5911 16.0999 14.4138 16.2792 12.4749 17.3713C12.2015 17.5645 11.8329 17.8814 11.332 18.3646C11.2956 18.3384 11.2566 18.3141 11.2056 18.2822C11.1648 18.2567 11.1161 18.2264 11.0549 18.1864C10.778 18.0055 10.3737 17.7607 9.8807 17.5162C8.86512 17.0123 7.61933 16.5826 6.39844 16.5826V12.7043C8.50949 12.7043 10.4075 13.421 11.7027 14.0636C12.152 14.2865 12.5463 14.5093 12.8726 14.7073C13.1613 14.0911 13.5422 13.518 13.9976 12.9896L11.801 9.54272L15.322 7.25618L17.3485 10.4363C18.1831 10.0059 19.0783 9.64876 20.0003 9.36808V6Z" fill="#5597c0"/>
        <path d="M30.7567 14.691C29.299 15.3667 28.0372 16.4774 26.8996 18.6154C26.8996 18.6154 24.3757 17.4612 22.3281 16.8613C23.8996 13.6753 25.7283 11.8827 28.425 10.6327C31.0336 9.42353 34.1456 9.11392 37.8425 9.24167L37.6675 14.0001C34.2564 13.8822 32.3024 13.9745 30.7567 14.691Z" fill="#dd655c"/>
        <path d="M13.281 19.2195C6.01833 25.6975 16.3935 41.8925 24.6938 41.8925C32.994 41.8925 44.4232 25.7119 36.1066 18.2941C35.9147 18.1229 35.7467 17.9689 35.5907 17.8259C34.9033 17.1956 34.4458 16.7762 33.1774 16.022C30.6251 16.022 29.087 18.5751 28.3868 20.1305C28.3512 20.2095 28.3073 20.2832 28.2565 20.3508L26.6423 24.8414L26.0606 26.9296C25.9992 27.1501 26.0152 27.3849 26.1061 27.595L26.7855 29.1652L30.3035 28.7569L30.5341 30.7435L27.2254 31.1276L27.4404 34.2794L25.4451 34.4155L25.1768 30.4837L24.2706 28.3892C23.9979 27.759 23.9497 27.0543 24.1339 26.3929L24.1513 26.3305L22.1173 27.2503L20.7874 30.6121L18.9276 29.8764L19.9809 27.214L16.7704 26.4576L17.229 24.5109L21.2345 25.4546L24.891 23.8009L26.1206 20.3804C22.9526 18.892 16.4469 16.3956 13.281 19.2195Z" fill="#bd334f"/>
        </g>`,
      'lungs':`<circle cx="120" cy="118" r="101" fill="url(#nm-med-halo)" opacity=".49"/><circle cx="120" cy="118" r="94" fill="none" stroke="#8eabd3" stroke-opacity=".24" stroke-width="1.3"/><circle cx="120" cy="118" r="77" fill="none" stroke="#8eabd3" stroke-opacity=".08" stroke-width="1.2"/><path d="M120 11v9m0 196v9M13 118h9m196 0h9" stroke="#b2c9e7" stroke-opacity=".4" stroke-width="1.5"/>
        <g transform="translate(15 15) scale(4.375)">
        <path d="M16.542 11.991C22.3921 11.9958 21.8536 19.9527 21.8511 23.1357C21.8478 27.198 22.8451 35.3972 19.7112 38.5181C16.5177 41.6984 10.1346 43.2846 6.94587 40.6296C3.75713 37.9745 9.09663 11.9849 16.542 11.991Z" fill="#ed8d99"/>
        <path d="M31.4826 12.0033C25.6326 11.9985 26.158 19.9563 26.1554 23.1392C26.152 27.2016 25.1413 35.3991 28.27 38.5252C31.4583 41.7107 37.8388 43.3074 41.0319 40.6576C44.2249 38.0077 38.928 12.0094 31.4826 12.0033Z" fill="#df788c"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M23.0175 5.99927C23.0175 5.99927 23.0175 5.99915 24.0175 5.99997C25.0175 6.00079 25.0175 6.00091 25.0175 6.00091L25.0056 20.4938C25.0039 22.5951 24.0675 23.7995 23.0074 24.4169C22.51 24.7066 22.0215 24.847 21.6634 24.9163C21.4824 24.9514 21.3289 24.9694 21.2159 24.9787C21.1592 24.9834 21.1123 24.9859 21.0765 24.9873C21.0587 24.988 21.0436 24.9884 21.0314 24.9886L21.0154 24.9888L21.0091 24.9888L21.0052 24.9888C21.0052 24.9888 21.004 24.9888 21.0048 23.9888C21.0056 22.9888 21.0045 22.9888 21.0045 22.9888H21.0035L21.0016 22.9889L20.9986 22.9889L20.9954 22.9889C20.9954 22.9889 20.9976 22.9889 21.0004 22.9887C21.0086 22.9884 21.0261 22.9876 21.0514 22.9855C21.1024 22.9813 21.1831 22.9722 21.2832 22.9528C21.4872 22.9133 21.7484 22.8357 22.0009 22.6886C22.4404 22.4327 23.0044 21.8892 23.0056 20.4922L23.0175 5.99927Z" fill="#cfb8b5"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M25.0175 6.00091C25.0175 6.00091 25.0175 6.00079 24.0175 5.99997C23.0175 5.99915 23.0175 5.99927 23.0175 5.99927L23.0056 20.4922C23.0039 22.5935 23.9382 23.7994 24.9974 24.4185C25.4943 24.709 25.9825 24.8502 26.3405 24.9201C26.5215 24.9555 26.675 24.9738 26.7879 24.9833C26.8446 24.988 26.8916 24.9906 26.9273 24.9921C26.9452 24.9928 26.9603 24.9932 26.9724 24.9934L26.9884 24.9937L26.9947 24.9937L26.9974 24.9937L26.9986 24.9937C26.9986 24.9937 26.9998 24.9937 27.0006 23.9937C27.0014 22.9937 27.0026 22.9937 27.0026 22.9937L27.0036 22.9937L27.0055 22.9937L27.0085 22.9938L27.0117 22.9938C27.0117 22.9938 27.0107 22.9938 27.0066 22.9936C26.9984 22.9933 26.981 22.9924 26.9557 22.9903C26.9047 22.986 26.824 22.9768 26.724 22.9572C26.52 22.9174 26.2589 22.8393 26.0067 22.6919C25.5676 22.4352 25.0044 21.8908 25.0056 20.4938L25.0175 6.00091Z" fill="#9cc4ce"/>
        </g>`,
      'brain':`<circle cx="120" cy="118" r="101" fill="url(#nm-med-halo)" opacity=".49"/><circle cx="120" cy="118" r="94" fill="none" stroke="#8eabd3" stroke-opacity=".24" stroke-width="1.3"/><circle cx="120" cy="118" r="77" fill="none" stroke="#8eabd3" stroke-opacity=".08" stroke-width="1.2"/><path d="M120 11v9m0 196v9M13 118h9m196 0h9" stroke="#b2c9e7" stroke-opacity=".4" stroke-width="1.5"/>
        <g transform="translate(15 15) scale(4.375)">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M29.5844 22.8706C30.7438 22.8706 31.8763 22.5549 32.8338 21.9648C33.806 22.5538 34.9534 22.8626 36.1242 22.8503L39.8433 21.6286C40.8913 20.8487 41.6107 19.7675 41.8813 18.5661C42.1518 17.3646 41.9569 16.1157 41.3293 15.0284C40.7017 13.9411 39.6794 13.0813 38.4336 12.5931C38.1491 11.4298 37.4326 10.3894 36.4029 9.64443L32.7725 8.49751H32.3638C31.5563 7.43391 30.344 6.67523 28.9574 6.36571L21.1741 5.9707C19.8803 6.06775 18.6603 6.55488 17.7105 7.35371C17.2617 7.25819 16.8023 7.20868 16.3412 7.20612C15.2247 7.20819 14.1327 7.50194 13.1971 8.05191C12.2615 8.60187 11.5222 9.38455 11.0685 10.3055L8.11115 12.1966C7.37528 13.0966 6.97913 14.1863 6.98108 15.305C6.9738 15.7727 7.04266 16.2389 7.18545 16.6886C6.40957 17.5975 5.99236 18.7143 6.00011 19.8617C5.99826 21.1925 6.56142 22.4733 7.57375 23.4407C7.65545 24.3934 8.02424 25.3079 8.64022 26.085C9.2562 26.8622 10.0959 27.4725 11.0685 27.8499C12.1891 28.4841 13.138 29.337 13.8453 30.3458C14.5527 31.3547 15.0005 32.4939 15.1559 33.6796H17.8743V25.9364L15.2325 23.5882L13.4451 25.3757C13.0545 25.7662 12.4214 25.7662 12.0308 25.3757C11.6403 24.9852 11.6403 24.352 12.0308 23.9615L14.1148 21.8775L13.4797 18.3848L10.6544 16.9721C10.1604 16.7251 9.96018 16.1244 10.2072 15.6304C10.4542 15.1365 11.0548 14.9362 11.5488 15.1832L14.3156 16.5666L17.7773 14.3638L16.7107 11.5197C16.5168 11.0026 16.7788 10.4262 17.2959 10.2322C17.813 10.0383 18.3895 10.3003 18.5834 10.8174L19.721 13.851H21.1199L21.7691 12.5526L20.8188 10.3352C20.6013 9.82758 20.8364 9.2397 21.344 9.02214C21.8517 8.80459 22.4396 9.03974 22.6571 9.54737L23.4829 11.4742L26.7826 12.0741C26.8011 12.0568 26.8204 12.0401 26.8405 12.0241L28.886 10.3877C29.3173 10.0427 29.9466 10.1126 30.2916 10.5439C30.6366 10.9751 30.5666 11.6044 30.1354 11.9494L28.6637 13.1268L30.3929 15.3499L31.0708 13.9941C31.2402 13.6553 31.5865 13.4413 31.9652 13.4413H34.4198C34.9721 13.4413 35.4198 13.889 35.4198 14.4413C35.4198 14.9936 34.9721 15.4413 34.4198 15.4413H32.5833L32.164 16.2799L34.2276 16.7384C34.3074 16.7562 34.3847 16.7836 34.4579 16.8202L36.0942 17.6384C36.5882 17.8854 36.7884 18.486 36.5415 18.98C36.2945 19.474 35.6938 19.6742 35.1998 19.4272L33.6736 18.6641L30.1119 17.8726C29.8848 17.8221 29.6823 17.694 29.5395 17.5104L26.9104 14.1301L23.6471 13.5368C23.5854 13.5943 23.5156 13.6446 23.4385 13.6859L22.7379 15.0871V15.8958H24.1925C24.3478 15.8958 24.5009 15.932 24.6397 16.0014L27.9125 17.6378C28.4064 17.8848 28.6067 18.4854 28.3597 18.9794C28.1127 19.4734 27.512 19.6736 27.018 19.4266L23.9564 17.8958H22.7379V19.7601C22.7379 20.3124 22.2902 20.7601 21.7379 20.7601C21.1856 20.7601 20.7379 20.3124 20.7379 19.7601V15.851H19.1655L15.4784 18.1973L16.1146 21.6964L19.5387 24.7399C19.7521 24.9297 19.8743 25.2017 19.8743 25.4873V33.6796H22.7915V28.145C22.7901 27.1624 23.0938 26.199 23.6682 25.3642C24.2425 24.5295 25.0645 23.8567 26.041 23.4222C26.5901 23.2326 26.7252 22.9773 26.8907 22.6645C27.001 22.456 27.1249 22.222 27.3937 21.9648C27.6273 22.1087 27.8082 22.2364 27.9652 22.347C28.4518 22.6901 28.7077 22.8706 29.5844 22.8706Z" fill="#dfb3a0"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M23 38.0001H15V36.0001H23V38.0001Z" fill="#aa7482"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M23 42.0001H15V40.0001H23V42.0001Z" fill="#aa7482"/>
        </g>`,
      'kidney':`<circle cx="120" cy="118" r="101" fill="url(#nm-med-halo)" opacity=".49"/><circle cx="120" cy="118" r="94" fill="none" stroke="#8eabd3" stroke-opacity=".24" stroke-width="1.3"/><circle cx="120" cy="118" r="77" fill="none" stroke="#8eabd3" stroke-opacity=".08" stroke-width="1.2"/><path d="M120 11v9m0 196v9M13 118h9m196 0h9" stroke="#b2c9e7" stroke-opacity=".4" stroke-width="1.5"/>
        <g transform="translate(15 15) scale(4.375)">
        <path d="M12.548 30.7532C1.68377 26.171 5.97137 10.7042 13.513 8.14865C16.6416 7.08852 20.0938 10.6056 20.0717 12.7893C20.0621 13.7335 19.5749 14.6541 19.0673 15.6132C18.4009 16.8725 17.6993 18.1982 17.9972 19.7308C18.5221 22.4309 19.11 26.9868 17.5952 29.1494C16.0803 31.312 14.5569 31.6005 12.548 30.7532Z" fill="#ba5f68"/>
        <path d="M34.3473 8.14865C41.889 10.7042 46.1766 26.171 35.3124 30.7532C33.3034 31.6005 31.78 31.312 30.2652 29.1494C28.7504 26.9868 29.3383 22.4309 29.8631 19.7308C30.161 18.1982 29.4595 16.8725 28.793 15.6132C28.2854 14.6541 27.7982 13.7335 27.7887 12.7893C27.7666 10.6056 31.2188 7.08852 34.3473 8.14865Z" fill="#aa485c"/>
        <path d="M28.6181 22.7796C28.6867 23.7773 28.6873 23.7772 28.6879 23.7772L28.6891 23.7771L28.6913 23.7769L28.6952 23.7766L28.7007 23.7762L28.7036 23.7759C28.7019 23.7761 28.6934 23.7771 28.6791 23.7794C28.6504 23.784 28.6001 23.7936 28.5357 23.8118C28.4046 23.849 28.2318 23.917 28.0626 24.0376C27.7729 24.2439 27.3469 24.7021 27.3469 25.8583V40.3244C27.3469 40.3245 27.3469 40.3245 26.3469 40.3245C25.3469 40.3245 25.3469 40.3241 25.3469 40.324V25.8583C25.3469 24.0919 26.0565 23.0108 26.9024 22.4084C27.301 22.1246 27.696 21.971 27.9907 21.8875C28.1393 21.8454 28.2665 21.82 28.3619 21.8047C28.4097 21.797 28.4501 21.7918 28.4816 21.7883C28.4974 21.7865 28.5111 21.7851 28.5224 21.7841L28.5377 21.7828L28.5441 21.7824L28.5469 21.7822L28.5482 21.7821C28.5489 21.782 28.5495 21.782 28.6181 22.7796Z" fill="#668db4"/>
        <path d="M19.2423 22.7796C19.1737 23.7773 19.173 23.7772 19.1724 23.7772L19.1713 23.7771L19.169 23.7769L19.1652 23.7766L19.1596 23.7762C19.1577 23.776 19.1567 23.7759 19.1565 23.7759C19.1582 23.7761 19.167 23.7771 19.1812 23.7794C19.21 23.784 19.2603 23.7936 19.3246 23.8118C19.4557 23.849 19.6285 23.917 19.7978 24.0376C20.0875 24.2439 20.5135 24.7021 20.5135 25.8583V40.3244C20.5135 40.3245 20.5135 40.3245 21.5135 40.3245C22.5135 40.3245 22.5135 40.3241 22.5135 40.324V25.8583C22.5135 24.0919 21.8038 23.0108 20.9579 22.4084C20.5594 22.1246 20.1644 21.971 19.8696 21.8875C19.7211 21.8454 19.5939 21.82 19.4985 21.8047C19.4506 21.797 19.4103 21.7918 19.3787 21.7883C19.3629 21.7865 19.3493 21.7851 19.3379 21.7841L19.3226 21.7828L19.3163 21.7824L19.3135 21.7822L19.3121 21.7821C19.3115 21.782 19.3108 21.782 19.2423 22.7796Z" fill="#668db4"/>
        </g>`,
      'liver':`<circle cx="120" cy="118" r="101" fill="url(#nm-med-halo)" opacity=".49"/><circle cx="120" cy="118" r="94" fill="none" stroke="#8eabd3" stroke-opacity=".24" stroke-width="1.3"/><circle cx="120" cy="118" r="77" fill="none" stroke="#8eabd3" stroke-opacity=".08" stroke-width="1.2"/><path d="M120 11v9m0 196v9M13 118h9m196 0h9" stroke="#b2c9e7" stroke-opacity=".4" stroke-width="1.5"/>
        <g transform="translate(15 15) scale(4.375)">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M23.2157 10.0607C22.5621 11.0012 22.112 11.962 21.8034 12.8418C21.446 13.8608 21.2754 14.777 21.1939 15.4417C21.153 15.7748 21.1342 16.047 21.1257 16.2402C21.1214 16.3368 21.1197 16.4139 21.1192 16.4692C21.1189 16.4969 21.1189 16.5191 21.1189 16.5356L21.1191 16.556L21.1192 16.563L21.1193 16.5656L21.1193 16.5667C21.1193 16.5667 21.1193 16.5677 22.1191 16.5479C23.1189 16.528 23.1189 16.5288 23.1189 16.5288L23.1189 16.5255L23.1189 16.5227L23.1191 16.4903C23.1194 16.4562 23.1205 16.4015 23.1238 16.3282C23.1302 16.1815 23.1451 15.9615 23.179 15.6853C23.247 15.1312 23.3904 14.3599 23.6907 13.5039C24.0603 12.4502 24.6632 11.2773 25.6539 10.2157C27.9787 10.4791 28.8525 11.0046 29.5758 11.4395C30.2149 11.8238 30.7364 12.1374 32.0374 12.1374C33.3805 12.1374 35.2609 11.7362 37.1413 11.335C39.9619 10.7332 42.7825 10.1315 43.7898 10.8837C45.4687 12.1374 40.432 21.3314 35.3952 21.3314C32.8027 21.3314 31.2481 23.1899 29.7392 24.9937C28.3166 26.6944 26.9347 28.3464 24.762 28.3464C22.6699 28.3464 21.311 29.0047 20 29.7061V23.0479C20 22.6526 20.195 22.2841 20.5335 21.9879C20.8909 21.6752 21.2902 21.5479 21.5 21.5479V19.5479C20.7098 19.5479 19.8591 19.9205 19.2165 20.4828C18.5727 21.0461 18.0298 21.8962 18.0012 22.9597H12.9072C10.5179 22.9597 7.65082 24.0112 10.5179 26.1135C12.5977 27.6385 16.186 26.4249 18 25.6433V30.707C17.0781 31.0885 16.0352 31.3613 14.6885 31.3613C12.8526 31.3613 12.2458 32.8297 11.6009 34.3903C10.8697 36.1599 10.0895 38.0479 7.41312 38.0479C2.37634 38.0479 3.61914 22.5479 6.61916 16.5479C9.61919 10.5479 13.7245 10.0479 22.1192 10.0479C22.5059 10.0479 22.8709 10.0523 23.2157 10.0607Z" fill="#aa6255"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M18 40.0479V30.707L20 29.7061V40.0479H18Z" fill="#7c434d"/>
        </g>`
    };
    const bodies={
      scroll:`<path d="M46 43Q55 34 67 38L187 34Q202 38 201 55L197 188Q194 201 181 201H57Q43 196 43 181Z" fill="url(#nm-oa-paper)" stroke="#956a35" stroke-width="3"/>
        <path d="M62 44V192M179 37V200" stroke="#a97a38" stroke-width="2" opacity=".24"/>
        <path d="M43 44C24 45 20 67 34 76C41 81 49 73 46 66C44 61 38 63 35 66" fill="none" stroke="url(#nm-oa-wood)" stroke-width="16" stroke-linecap="round"/>
        <path d="M200 43C219 43 224 66 209 75C203 79 196 75 195 68C194 63 200 62 204 66" fill="none" stroke="url(#nm-oa-wood)" stroke-width="16" stroke-linecap="round"/>
        <path d="M43 199C22 197 19 175 34 166C42 163 48 169 47 176C47 181 40 181 36 177" fill="none" stroke="url(#nm-oa-wood)" stroke-width="16" stroke-linecap="round"/>
        <path d="M199 202C220 200 224 176 208 167C201 162 195 168 195 176C195 182 202 183 207 177" fill="none" stroke="url(#nm-oa-wood)" stroke-width="16" stroke-linecap="round"/>
        <path d="M64 66Q123 63 178 66M64 173Q122 176 179 172" stroke="#ae824c" stroke-width="1.6" fill="none"/>
        <g fill="#9b713e" opacity=".64"><circle cx="65" cy="79" r="2"/><circle cx="179" cy="80" r="2"/><circle cx="65" cy="161" r="2"/><circle cx="179" cy="162" r="2"/></g>
        <path d="M84 95h77m-77 11h62m-62 11h71m-71 11h53m-53 11h69m-69 11h47" stroke="#87663c" stroke-width="2.4" stroke-linecap="round" opacity=".48"/>
        <path d="m114 162 8-14 8 14-8 7Z" fill="#997444" opacity=".7"/>`,
      amphora:`<ellipse cx="121" cy="220" rx="58" ry="7" fill="#1d2439" opacity=".29"/>
        <path d="M94 61C45 46 36 72 50 112C60 134 77 128 85 118" fill="none" stroke="#935641" stroke-width="15" stroke-linecap="round"/>
        <path d="M146 61C196 48 204 72 190 112C180 132 162 127 154 117" fill="none" stroke="#935641" stroke-width="15" stroke-linecap="round"/>
        <path d="M94 55 91 80C82 94 69 110 74 140C78 175 94 206 119 213C149 213 166 179 168 139C171 109 159 93 148 80L146 55Z" fill="url(#nm-oa-clay)" stroke="#763e37" stroke-width="3"/>
        <path d="M90 84C78 99 75 118 78 139" stroke="#ffe1ae" stroke-width="6" opacity=".55" stroke-linecap="round" fill="none"/>
        <path d="M157 92C168 107 170 125 168 144" stroke="#4d2a3c" stroke-width="6" opacity=".4" fill="none"/>
        <rect x="89" y="42" width="60" height="18" rx="5" fill="#c98f58" stroke="#764233" stroke-width="3"/>
        <ellipse cx="119" cy="42" rx="30" ry="7" fill="#513039" stroke="#efc48c" stroke-width="4"/>
        <path d="M81 128Q120 119 165 128V149Q120 159 81 149Z" fill="#663448" opacity=".91"/>
        <path d="M84 136Q120 145 162 136m-77 8q38 10 76 0" fill="none" stroke="#f2c288" stroke-width="2.5"/>
        <path d="M108 127Q119 112 131 127m-29 0q17-29 36 0" fill="none" stroke="#f2bd79" stroke-width="2"/>
        <path d="M103 177q15 13 31 0m-23 13q9 7 18 0" stroke="#f7c58c" stroke-width="2.4" fill="none"/>
        <path d="M96 68h47" stroke="#f6cf92" stroke-width="4" stroke-linecap="round"/>`,
      frame:`<rect x="26" y="35" width="188" height="162" rx="5" fill="#402e39" stroke="#f5d899" stroke-width="3"/>
        <rect x="34" y="43" width="172" height="146" rx="3" fill="url(#nm-oa-gold)" stroke="#7f542a" stroke-width="2"/>
        <rect x="46" y="55" width="148" height="122" fill="#141c31" stroke="#f9df9c" stroke-width="3"/>
        <rect x="55" y="64" width="130" height="104" fill="url(#nm-oa-sky)"/>
        <circle cx="149" cy="87" r="14" fill="#f3c99e"/>
        <path d="M55 140c31-37 48-24 69-49 18-16 37-11 61 28v49H55Z" fill="#447475"/>
        <path d="M55 153q38-24 65-16 33 7 65-24v55H55Z" fill="#1c3850"/>
        <path d="M55 165q50-25 130-10" stroke="#9ad2bb" stroke-width="2" opacity=".8" fill="none"/>
        <path d="M63 120q13-21 23-8m68 30q12-17 21-10" stroke="#d2e5c8" stroke-width="2" fill="none"/>
        <path d="m38 41 16 18m150-18-18 18M38 191l16-17m150 17-18-17" stroke="#fff5c9" stroke-width="3" opacity=".65"/>
        <rect x="101" y="202" width="38" height="13" rx="3" fill="url(#nm-oa-gold)"/>
        <path d="M110 208h20" stroke="#845b2e" stroke-width="1.5"/>`
    };
    const body=bodies[id]||anatomyBodies[id]||galleryPack.body(id);
    const result=`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">${defs}${body}</svg>`;
    objectSvgCache.set(id,result);
    return result;
  }

  const objectUrlCache=new Map();
  function objectURL(id){
    if(!artById.has(id))return '';
    if(!objectUrlCache.has(id))objectUrlCache.set(id,
      'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(objectSVG(id)));
    return objectUrlCache.get(id);
  }
  function objectGeometry(node,m){
    const art=objectArt(node?.objectArt);
    if(!art||!m)return null;
    const lines=m.lines||[String(node.text||'')],lineHeight=m.lineHeight||20;
    const top=m.y-m.height/2+5;
    const labelWidth=Math.max(78,Math.min(m.width-8,(m.textWidth||85)+24));
    return {art,lines,lineHeight,top,
      imageX:m.x-art.size/2,imageY:top,
      labelX:m.x-labelWidth/2,labelY:top+art.size+6,
      labelWidth,labelHeight:lines.length*lineHeight+12};
  }
  function paintObject(renderer,node,m,selected){
    const g=objectGeometry(node,m);if(!g)return false;
    const ctx=renderer.ctx;
    const image=renderer.getOrLoadImage(objectURL(g.art.id));
    const mask=renderer._nmLearnRecall;
    const hidden=mask?.state===renderer.state&&mask.hiddenIds?.has?.(node.logicalId||node.id);
    ctx.save();
    if(selected&&!renderer._nmNavExport){
      renderer.roundRectPath(g.imageX-4,g.imageY-4,g.art.size+8,g.art.size+8,16);
      ctx.strokeStyle='#bbd2ff';ctx.lineWidth=2.5;
      ctx.shadowColor='#8b90ff';ctx.shadowBlur=13;ctx.stroke();ctx.shadowBlur=0;
    }
    if(image)ctx.drawImage(image,g.imageX,g.imageY,g.art.size,g.art.size);
    renderer.roundRectPath(g.labelX,g.labelY,g.labelWidth,g.labelHeight,10);
    ctx.fillStyle='rgba(17,31,54,.96)';ctx.fill();
    ctx.strokeStyle=selected?'#bdd5ff':'#697f9f';ctx.lineWidth=selected?1.6:1;
    ctx.stroke();
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=(node.fontItalic?'italic ':'')+(m.fontWeight||500)+' '+(m.fontSize||16)+
      'px '+(globalThis.GlaukaNodeText?.cssFamily(node)||'Inter,system-ui,sans-serif');
    ctx.fillStyle='#f3f7ff';
    const lines=renderer.isEditingLabel?.(node,ctx)?[]:hidden?['••••']:g.lines;
    lines.forEach((line,i)=>ctx.fillText(line,m.x,
      g.labelY+6+g.labelHeight/2+(i-(lines.length-1)/2)*g.lineHeight-6,
      Math.max(16,g.labelWidth-12)));
    ctx.restore();
    return true;
  }
  // Each SVG export stores one vector resource per distinct artwork; every
  // repeated node uses a local reference, keeping large maps compact.
  function svgObjectDef(id){
    if(!artById.has(id))return '';
    return '<image id="nm-art-asset-'+id+'" width="240" height="240" '+
      'href="'+esc(objectURL(id))+'"/>';
  }
  function svgObject(node,m,reuse=false){
    const g=objectGeometry(node,m);if(!g)return '';
    const src=objectURL(g.art.id);
    const rect='<rect x="'+g.labelX+'" y="'+g.labelY+'" width="'+g.labelWidth+
      '" height="'+g.labelHeight+'" rx="10" fill="#111f36" fill-opacity=".96" stroke="#697f9f"/>';
    const lines=g.lines.map((line,i)=>'<text x="'+m.x+'" y="'+
      (g.labelY+g.labelHeight/2+(i-(g.lines.length-1)/2)*g.lineHeight)+
      '" text-anchor="middle" dominant-baseline="middle" font-size="'+(m.fontSize||16)+
      '" font-weight="'+(m.fontWeight||500)+'" font-style="'+(node.fontItalic?'italic':'normal')+
      '" fill="#f3f7ff">'+esc(line)+'</text>').join('');
    const image=reuse
      ? '<use href="#nm-art-asset-'+g.art.id+'" transform="translate('+
        g.imageX+' '+g.imageY+') scale('+(g.art.size/240)+')"/>'
      : '<image x="'+g.imageX+'" y="'+g.imageY+'" width="'+g.art.size+
        '" height="'+g.art.size+'" href="'+esc(src)+'"/>';
    return image+rect+lines;
  }
