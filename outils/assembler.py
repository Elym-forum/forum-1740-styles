#!/usr/bin/env python3
"""Assemble les feuilles du thème en un seul fichier : theme/theme-1740.css.
Usage : python3 outils/assembler.py (depuis la racine du dépôt)."""
import pathlib, re
racine = pathlib.Path(__file__).resolve().parent.parent / 'theme'
morceaux = ['themes.css', 'base.css', 'entete.css', 'index.css', 'sujet.css', 'liste.css', 'lettres.css', 'membres.css', 'formulaires.css', 'secondaires.css', 'codes.css']
tete = """/* ==========================================================================
   THÈME 1740 (© Elym) — feuille assemblée
   Ne pas modifier directement : elle est générée par outils/assembler.py
   à partir de themes.css, base.css, entete.css, index.css, sujet.css, liste.css, lettres.css, membres.css, formulaires.css, secondaires.css et codes.css.
   ========================================================================== */

"""
corps = ''
for nom in morceaux:
    texte = (racine / nom).read_text(encoding='utf-8')
    texte = re.sub(r'@import[^\n]*\n', '', texte)
    corps += '/* ---------- ' + nom + ' ---------- */\n' + texte.rstrip() + '\n\n'
(racine / 'theme-1740.css').write_text(tete + corps, encoding='utf-8')
print('theme-1740.css :', len(tete + corps), 'caractères')
