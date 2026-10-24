#!/usr/bin/env python3
"""Build the two small packages that fisicabit.com loads into its embedded MakeCode editor.

fisicabit.com pins its projects to the repository martinferreiraHCA/pxt-fisicabit-usb:
  * branch "main"      -> package "fisicabit-usb"  : categories FisicaBit USB + Ultrasonic
  * branch "bluetooth" -> package "fisicabit-bt"   : the same plus FisicaBit Bluetooth, one package
The site resolves the branch commit through the GitHub API, so pushing to those branches
updates the site's editor within minutes. Block ids are the same as here, so saved projects
keep their blocks; the legacy Spanish names used by the site are kept by tools/site-compat/.

Usage (from the root of this repository):
    python3 tools/mirror-site.py <output-dir>
Creates <output-dir>/main and <output-dir>/bluetooth with the complete file trees to copy
over the corresponding branches of pxt-fisicabit-usb (delete the old files first).
"""
import json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'built', 'site-mirror')

# Source files of the slim package, in pxt.json order
CORE_FILES = ['data.ts', 'serial.ts', 'ultrasonic.ts', 'enums.d.ts', 'shims.cpp',
              'pxtparts.json', 'parts/hcsr04.svg', 'parts/hysrf05.svg']
TUTORIALS = ['tutorial-usb.md', '_locales/es/tutorial-usb.md', '_locales/pt-BR/tutorial-usb.md']
BT_TUTORIALS = ['tutorial-bluetooth.md', '_locales/es/tutorial-bluetooth.md', '_locales/pt-BR/tutorial-bluetooth.md']
EXTRA = ['icon.png', 'card.png', 'LICENSE', 'docs/img/hc-sr04-microbit.png', 'docs/img/hc-sr04-microbit.svg',
         'docs/img/hy-srf05-microbit.png', 'docs/img/hy-srf05-microbit.svg']
# Locale keys kept: these namespaces, enums and groups
NAMESPACES = ['fisicabitSerial', 'fisicabitUltrasonic', 'fisicabitData']
ENUMS = ['FbSampleRate', 'FbChannel', 'FbDistanceUnit', 'FbUltrasonicFilter']
GROUPS = ['1. Send (inside forever)', '2. Optional', 'Advanced', 'Send without time',
          'Configuration', 'Diagnostics', 'Measurement']
BT_NAMESPACE = 'fisicabitBluetooth'
BT_GROUPS = ['1. Start (in on start)', '2. Send (inside forever)', '3. Optional', 'BLE Services']


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


def keep_key(key, namespaces, groups):
    if key.startswith('{id:group}'):
        return key[len('{id:group}'):] in groups
    head = key.split('|')[0].split('.')[0]
    return head in namespaces or head in ENUMS


def build(name, with_bluetooth):
    out = os.path.join(OUT, 'bluetooth' if with_bluetooth else 'main')
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)
    core = load(os.path.join(ROOT, 'pxt.json'))
    core_name = core['name']
    namespaces = NAMESPACES + ([BT_NAMESPACE] if with_bluetooth else [])
    groups = GROUPS + (BT_GROUPS if with_bluetooth else [])

    files = ['README.md'] + CORE_FILES[:]
    for f in CORE_FILES:
        if f == 'pxtparts.json':
            parts = load(os.path.join(ROOT, f))
            dump({k: v for k, v in parts.items() if k in ('hcsr04', 'hysrf05')}, os.path.join(out, f))
        else:
            copy(f, out)
    if with_bluetooth:
        copy('bluetooth/bluetooth.ts', out, 'bluetooth.ts')
        files.insert(files.index('serial.ts') + 1, 'bluetooth.ts')
    # Legacy Spanish API used by fisicabit.com and by projects saved there
    copy('tools/site-compat/compat-enums.d.ts', out, 'compat-enums.d.ts')
    copy('tools/site-compat/compat.ts', out, 'compat.ts')
    files += ['compat-enums.d.ts', 'compat.ts']
    if with_bluetooth:
        copy('tools/site-compat/compat-bt.ts', out, 'compat-bt.ts')
        files.append('compat-bt.ts')
    # Locales: only the keys of the shipped namespaces
    for lang in ('es', 'pt-BR'):
        for kind in ('strings', 'jsdoc-strings'):
            merged = {k: v for k, v in load(os.path.join(ROOT, f'_locales/{lang}/{core_name}-{kind}.json')).items()
                      if keep_key(k, namespaces, groups)}
            if with_bluetooth:
                bt = os.path.join(ROOT, 'bluetooth', '_locales', lang, f'fisicabit-bluetooth-{kind}.json')
                if os.path.exists(bt):
                    merged.update(load(bt))
            rel = f'_locales/{lang}/{name}-{kind}.json'
            dump(dict(sorted(merged.items())), os.path.join(out, rel))
            files.append(rel)
    for f in TUTORIALS + (BT_TUTORIALS if with_bluetooth else []):
        copy(f, out)
        files.append(f)
    for f in EXTRA:
        if os.path.exists(os.path.join(ROOT, f)):
            copy(f, out)
    copy('tools/site-compat/README-site.md', out, 'README.md')
    copy('tools/site-compat/test.ts', out, 'test.ts')

    cfg = {
        'name': name,
        'version': core['version'],
        'description': ('micro:bit (V2) only. FisicaBit for fisicabit.com: send data over USB'
                        + (' or Bluetooth LE' if with_bluetooth else '')
                        + ', HC-SR04 / HY-SRF05 ultrasonic distance with physical time stamps'
                        + (' (replaces fisicabit-usb; incompatible with radio)' if with_bluetooth else ' (Bluetooth: fisicabit-bt)')),
        'license': core['license'],
        'authors': core['authors'],
        'public': True,
        'dependencies': {'core': '*', **({'bluetooth': '*'} if with_bluetooth else {}), 'microphone': '*'},
        'files': files,
        'testFiles': ['test.ts'],
        'supportedTargets': core['supportedTargets'],
        'preferredEditor': core.get('preferredEditor', 'tsprj'),
        'disablesVariants': core.get('disablesVariants', ['mbdal']),
    }
    dump(cfg, os.path.join(out, 'pxt.json'))
    print(f'{name}: {len(files)} files -> {out}')


build('fisicabit-usb', False)
build('fisicabit-bt', True)
