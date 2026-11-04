// Bina apps-script/Index.html (satu fail untuk Apps Script) daripada index.html + css/style.css + js/app.js + img/logo.png
// Fail root (index.html, css/, js/, img/, manifest.json, sw.js) terus digunakan oleh GitHub Pages.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'img/logo.png')).toString('base64');
let h = rd('index.html');
h = h.replace('<link rel="stylesheet" href="css/style.css">', () => '<style>\n' + rd('css/style.css') + '\n</style>');
h = h.replace('<script src="js/config.js"></script>\n', '');
h = h.replace('<script src="js/app.js"></script>', () => '<script>\n' + rd('js/app.js').replace(/<\/script/gi, '<\\/script') + '\n</script>');
h = h.replace(/<link rel="(manifest|apple-touch-icon)"[^>]*>\n?/g, '').replace('<link rel="icon" href="img/logo.png">', () => '<link rel="icon" href="' + logo + '">');
h = h.split('src="img/logo.png"').join('src="' + logo + '"');
fs.writeFileSync(path.join(root, 'apps-script/Index.html'), h);
console.log('Dibina apps-script/Index.html (' + Math.round(h.length / 1024) + ' KB)');
