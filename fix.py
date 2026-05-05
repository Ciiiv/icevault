with open('docs/index.html', encoding='utf-8') as f:
    content = f.read()

old = """onclick="openLightbox('${(c.imageUrl||c.imageData).replace(/'/g,"\\\\'")}','${c.player} · ${c.year||''} ${c.brand||''}')" style="cursor:zoom-in;" title="Click to enlarge">"""

new = """data-cap="${c.player}" onclick="openLightbox(this.src,this.dataset.cap)" style="cursor:zoom-in;" title="Click to enlarge">"""

if old in content:
    content = content.replace(old, new)
    with open('docs/index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed')
else:
    print('Not found - searching for context...')
    idx = content.find('openLightbox')
    while idx != -1:
        ctx = content[idx:idx+80]
        if 'imageUrl' in ctx or 'imageData' in ctx:
            print(repr(ctx))
        idx = content.find('openLightbox', idx+1)