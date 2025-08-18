# -*- mode: python ; coding: utf-8 -*-

import os
import sys

# Add the backend directory to the path
backend_dir = os.path.join(os.getcwd(), 'backend')

a = Analysis(
    ['backend/cli.py'],
    pathex=[backend_dir, os.getcwd()],
    binaries=[],
    datas=[
        ('backend/*.py', 'backend'),
        ('user.settings', '.'),
    ],
    hiddenimports=[
        'backend.report_generator',
        'backend.settings',
        'backend.student',
        'backend.letter',
        'backend.logo',
        'backend.translate',
        'backend.util',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='report-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)