// When was a photo taken? Read it from the picture itself (EXIF DateTimeOriginal),
// else from the file name (IMG_20261121_134501.jpg), else from the file's modified time.

function exifFromJpeg(buf) {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
  let o = 2;
  while (o + 4 < v.byteLength) {
    const marker = v.getUint16(o);
    const len = v.getUint16(o + 2);
    if (marker === 0xffe1 && v.getUint32(o + 4) === 0x45786966) return readTiff(v, o + 10); // "Exif"
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
    o += 2 + len;
  }
  return null;
}

function readTiff(v, t) {
  const le = v.getUint16(t) === 0x4949;
  const u16 = (p) => v.getUint16(p, le);
  const u32 = (p) => v.getUint32(p, le);
  const str = (p, n) => { let s = ''; for (let i = 0; i < n - 1 && p + i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(p + i)); return s; };
  const tags = (ifd) => {
    const out = {};
    if (t + ifd + 2 > v.byteLength) return out;
    const n = u16(t + ifd);
    for (let i = 0; i < n; i++) {
      const e = t + ifd + 2 + i * 12;
      if (e + 12 > v.byteLength) break;
      const tag = u16(e), type = u16(e + 2), cnt = u32(e + 4);
      if (type === 2) out[tag] = str(cnt > 4 ? t + u32(e + 8) : e + 8, cnt);
      else if (type === 4) out[tag] = u32(e + 8);
    }
    return out;
  };
  const ifd0 = tags(u32(t + 4));
  const exif = ifd0[0x8769] ? tags(ifd0[0x8769]) : {};
  return exif[0x9003] || exif[0x9004] || ifd0[0x0132] || null;
}

const parse = (s) => {
  const m = s && s.match(/(\d{4})[:-](\d\d)[:-](\d\d)[ T](\d\d):(\d\d)(?::(\d\d))?/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : null;
};

const sane = (d) => d && !isNaN(d) && d.getFullYear() > 2000 && d.getTime() < Date.now() + 86400e3;

export async function photoTakenAt(file) {
  try {
    const d = parse(exifFromJpeg(await file.slice(0, 256 * 1024).arrayBuffer()));
    if (sane(d)) return d;
  } catch { /* not a jpeg */ }
  const m = (file.name || '').match(/(20\d\d)(\d\d)(\d\d)[_-]?(\d\d)(\d\d)(\d\d)?/);
  if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)); if (sane(d)) return d; }
  const lm = file.lastModified ? new Date(file.lastModified) : null;
  return sane(lm) ? lm : new Date();
}
