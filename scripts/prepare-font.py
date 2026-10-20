"""Optional asset generation; requires fonttools[woff] and a system Noto CJK font."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools import subset
font = TTFont('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', fontNumber=2)
options = subset.Options()
options.layout_features = []
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=font.getBestCmap().keys())
subsetter.subset(font)
glyphs = font.getGlyphSet()
fb = FontBuilder(font['head'].unitsPerEm, isTTF=True)
fb.setupGlyphOrder(font.getGlyphOrder())
fb.setupCharacterMap(font.getBestCmap())
converted = {}
for name in font.getGlyphOrder():
    pen = TTGlyphPen(None)
    glyphs[name].draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
    converted[name] = pen.glyph()
fb.setupGlyf(converted)
fb.setupHorizontalMetrics(font['hmtx'].metrics)
fb.setupHorizontalHeader(ascent=font['hhea'].ascent, descent=font['hhea'].descent)
fb.setupNameTable({'familyName': 'Longun Form Sans', 'styleName': 'Regular', 'uniqueFontIdentifier': 'LongunFormSans-Regular', 'fullName': 'Longun Form Sans Regular', 'psName': 'LongunFormSans-Regular', 'copyright': 'Derived from Noto Sans CJK SC. Copyright 2010-2012 Google Corporation. SIL Open Font License 1.1.'})
fb.setupOS2(sTypoAscender=font['OS/2'].sTypoAscender, sTypoDescender=font['OS/2'].sTypoDescender, usWinAscent=font['OS/2'].usWinAscent, usWinDescent=font['OS/2'].usWinDescent)
fb.setupPost(keepGlyphNames=False)
fb.save('public/fonts/LongunFormSans.ttf')
fb.font.flavor = 'woff2'
fb.save('public/fonts/LongunFormSans.woff2')
print('TTF and WOFF2 generated, Unicode characters:', len(font.getBestCmap()))
