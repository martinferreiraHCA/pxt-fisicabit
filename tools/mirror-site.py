#!/usr/bin/env python3
"""Build the two packages that fisicabit.com loads into its embedded MakeCode editor.

fisicabit.com pins its projects to the repository martinferreiraHCA/pxt-fisicabit-usb:
  * branch "main"      -> package "fisicabit-usb"  (this extension without Bluetooth)
  * branch "bluetooth" -> package "fisicabit-bt"   (this extension plus bluetooth.ts, one package)
The site resolves the branch commit through the GitHub API, so pushing to those branches
updates the site's editor within minutes. Block ids are the same, so saved projects keep
their blocks.

Usage (from the root of this repository):
    python3 tools/mirror-site.py <output-dir>
Creates <output-dir>/main and <output-dir>/bluetooth with the complete file trees to copy
over the corresponding branches of pxt-fisicabit-usb (delete the old files first).
"""
import json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'built', 'site-mirror')
EXTRA = ['README-es.md', 'test.ts', 'icon.png', 'card.png', 'LICENSE', 'tests/native-check.ts',
         'docs/img/hc-sr04-microbit.png', 'docs/img/hc-sr04-microbit.svg',
         'docs/img/hy-srf05-microbit.png', 'docs/img/hy-srf05-microbit.svg']


def load(path):
    return json.load(open(path, encoding='utf-8'))


def dump(obj, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(obj, open(path, 'w', encoding='utf-8'), indent=4, ensure_ascii=False)
    open(path, 'a').write('\n')


def copy(src_rel, dst_root, dst_rel=None):
    dst = os.path.join(dst_root, dst_rel or src_rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy(os.path.join(ROOT, src_rel), dst)


def build(name, with_bluetooth):
    out = os.path.join(OUT, 'bluetooth' if with_bluetooth else 'main')
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)
    cfg = load(os.path.join(ROOT, 'pxt.json'))
    core_name = cfg['name']
    files = []
    for f in cfg['files']:
        if '_locales/' in f and core_name in f:
            new = f.replace(core_name, name)
            if with_bluetooth:
                lang = f.split('/')[1]
                kind = 'jsdoc-strings' if 'jsdoc' in f else 'strings'
                merged = load(os.path.join(ROOT, f))
                bt = os.path.join(ROOT, 'bluetooth', '_locales', lang, f'fisicabit-bluetooth-{kind}.json')
                if os.path.exists(bt):
                    merged.update(load(bt))
                dump(dict(sorted(merged.items())), os.path.join(out, new))
            else:
                copy(f, out, new)
            files.append(new)
        else:
            copy(f, out)
            files.append(f)
    if with_bluetooth:
        copy('bluetooth/bluetooth.ts', out, 'bluetooth.ts')
        files.insert(files.index('serial.ts') + 1, 'bluetooth.ts')
    for f in EXTRA:
        if os.path.exists(os.path.join(ROOT, f)):
            copy(f, out)
    # README: the site mirror explains where it comes from
    readme = open(os.path.join(ROOT, 'README.md'), encoding='utf-8').read()
    note = ('\n> **Mirror for fisicabit.com.** This branch is generated from '
            '[pxt-fisicabit](https://github.com/martinferreiraHCA/pxt-fisicabit) with `tools/mirror-site.py`; '
            'it is the package that the editor embedded in fisicabit.com loads'
            + (' (with Bluetooth included in the same package)' if with_bluetooth else '')
            + '. Do not edit it by hand: change pxt-fisicabit and regenerate.\n')
    first_nl = readme.index('\n')
    open(os.path.join(out, 'README.md'), 'w', encoding='utf-8').write(readme[:first_nl + 1] + note + readme[first_nl + 1:])
    cfg['name'] = name
    cfg['files'] = files
    deps = {'core': '*'}
    if with_bluetooth:
        deps['bluetooth'] = '*'
    deps.update({k: v for k, v in cfg['dependencies'].items() if k not in ('core', 'bluetooth')})
    cfg['dependencies'] = deps
    if with_bluetooth:
        cfg['description'] = ('micro:bit (V2) only. FisicaBit for fisicabit.com with Bluetooth: sensors, photogates, '
                              'precision accelerometer, ultrasonic and ToF distance, data streaming over USB and Bluetooth LE '
                              '(replaces fisicabit-usb; incompatible with radio)')
    else:
        cfg['description'] = ('micro:bit (V2) only. FisicaBit for fisicabit.com: sensors, photogates, precision accelerometer, '
                              'ultrasonic and ToF distance, data streaming over USB (Bluetooth: fisicabit-bt)')
    dump(cfg, os.path.join(out, 'pxt.json'))
    print(f'{name}: {len(files)} files -> {out}')


build('fisicabit-usb', False)
build('fisicabit-bt', True)
