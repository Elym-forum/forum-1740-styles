/* ==========================================================================
   FORUM 1740 — SCRIPT DU THÈME (© Elym)
   Thèmes, musique, barre d'outils, accueil et mise en forme de l'index.
   Les réglages modifiables sont dans window.CONFIG_1740 (overall_header).
   ========================================================================== */
(function () {
	'use strict';

	var CONFIG = window.CONFIG_1740 || {};
	var THEMES = ['mousse', 'rouille', 'ocre'];
	var CLE_THEME = 'theme1740';

	function $(sel, ctx) { return (ctx || document).querySelector(sel); }
	function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
	/* ------------------------------------------------------------------
	   0. Réglages lus dans <div id="reglages-1740"> (overall_header).
	      Forumactif abîme les objets JavaScript dans les templates :
	      les réglages sont donc écrits en attributs HTML.
	   ------------------------------------------------------------------ */
	function lireReglages() {
		var el = document.getElementById('reglages-1740');
		if (!el) { return; }
		function attr(nom) { var v = el.getAttribute(nom); return v === null ? undefined : v; }
		if (attr('data-theme-defaut')) { CONFIG.themeParDefaut = attr('data-theme-defaut'); }
		if (attr('data-musique') !== undefined) { CONFIG.musique = attr('data-musique'); }
		if (attr('data-volume')) { CONFIG.volumeMusique = parseFloat(attr('data-volume')); }
		if (attr('data-duree-rumeur')) { CONFIG.dureeRumeur = parseFloat(attr('data-duree-rumeur')); }
		if (attr('data-nb-ecrits')) { CONFIG.nbDerniersEcrits = parseInt(attr('data-nb-ecrits'), 10); }
		if (attr('data-vignette-defaut')) { CONFIG.vignetteParDefaut = attr('data-vignette-defaut'); }

		var chapitres = Array.prototype.slice.call(el.querySelectorAll('[data-chapitre]'));
		if (chapitres.length) {
			chapitres.sort(function (a, b) { return (parseInt(a.getAttribute('data-chapitre'), 10) || 0) - (parseInt(b.getAttribute('data-chapitre'), 10) || 0); });
			CONFIG.chapitres = chapitres.map(function (c) {
				var r = { gabarit: c.getAttribute('data-gabarit') || 'terres', surtitre: c.getAttribute('data-surtitre') || '' };
				if (c.hasAttribute('data-bandeau')) { r.bandeau = c.getAttribute('data-bandeau'); }
				var tuiles = Array.prototype.slice.call(c.querySelectorAll('[data-tuile]'));
				if (tuiles.length) {
					r.tuiles = tuiles.map(function (t) { return { titre: t.textContent.trim(), lien: t.getAttribute('href') || '#' }; });
				}
				if (c.hasAttribute('data-panneau-titre') || c.hasAttribute('data-panneau-sous') || c.hasAttribute('data-panneau-lien')) {
					r.panneau = {
						titre: c.getAttribute('data-panneau-titre') || '',
						sous: c.getAttribute('data-panneau-sous') || '',
						lien: c.getAttribute('data-panneau-lien') || '',
						image: c.getAttribute('data-panneau-image') || ''
					};
				}
				return r;
			});
		}

		CONFIG.vignettes = CONFIG.vignettes || {};
		Array.prototype.forEach.call(el.querySelectorAll('[data-forum][data-image]'), function (v) {
			CONFIG.vignettes[v.getAttribute('data-forum')] = v.getAttribute('data-image');
		});
	}

	function lireStockage(cle) { try { return window.localStorage.getItem(cle); } catch (e) { return null; } }
	function ecrireStockage(cle, val) { try { window.localStorage.setItem(cle, val); } catch (e) { /* stockage indisponible */ } }

	/* ------------------------------------------------------------------
	   1. Thèmes
	   ------------------------------------------------------------------ */
	function appliquerTheme(nom) {
		if (THEMES.indexOf(nom) === -1) { nom = CONFIG.themeParDefaut || 'mousse'; }
		document.documentElement.setAttribute('data-theme', nom);
		$$('[data-choix-theme]').forEach(function (b) {
			b.setAttribute('aria-pressed', b.getAttribute('data-choix-theme') === nom ? 'true' : 'false');
		});
	}

	function initThemes() {
		appliquerTheme(lireStockage(CLE_THEME));
		$$('[data-choix-theme]').forEach(function (b) {
			b.addEventListener('click', function () {
				var nom = b.getAttribute('data-choix-theme');
				ecrireStockage(CLE_THEME, nom);
				appliquerTheme(nom);
			});
		});
	}

	/* ------------------------------------------------------------------
	   2. Membre connecté ou invité
	   ------------------------------------------------------------------ */
	function initMembre() {
		var u = window._userdata || {};
		var connecte = String(u.session_logged_in) === '1';
		var html = document.documentElement;
		html.classList.add(connecte ? 'est-connecte' : 'est-invite');

		if (connecte) {
			$$('.nom-membre-1740').forEach(function (el) { el.textContent = u.username || ''; });
			$$('.lien-profil-membre-1740').forEach(function (el) { if (u.user_id) { el.href = '/u' + u.user_id; } });

			// Avatar dans la barre d'outils
			var zone = $('#barre-1740 .barre-avatar');
			if (zone && u.avatar) {
				var tmp = document.createElement('div');
				tmp.innerHTML = u.avatar;
				var img = tmp.querySelector('img');
				if (img) { zone.innerHTML = ''; img.alt = ''; zone.appendChild(img); }
			}

		}

		// Lien de déconnexion : repris de la navigation native (il contient un jeton de sécurité)
		var deconnexion = $('#modernbb-nav-menu a[href*="logout"]');
		$$('.lien-deconnexion-1740').forEach(function (el) {
			if (deconnexion) { el.href = deconnexion.href; } else { el.style.display = 'none'; }
		});

		if (connecte) { initCompteurs(); initPanneauAvis(); }
	}

	/* ------------------------------------------------------------------
	   2 bis. Compteurs des sceaux (lettres et avis)
	   Forumactif affiche ces nombres dans son propre code :
	   - messages privés non lus : <span class="toread-message">1 message non lu</span>
	     (ou l'image #i_icon_mini_new_message, dont le texte alternatif est identique)
	   - notifications non lues : <span id="notif_unread">(2)</span> dans sa barre d'outils
	   On les lit, puis on les surveille : la barre se met à jour seule.
	   ------------------------------------------------------------------ */
	function lireNombre(texte) {
		var m = String(texte || '').match(/\d+/);
		return m ? parseInt(m[0], 10) : 0;
	}

	function majSceau(nom, n) {
		var sceau = $('#barre-1740 [data-compteur="' + nom + '"]');
		if (!sceau) { return; }
		var texte = n > 0 ? (n > 99 ? '99+' : String(n)) : '';
		if (sceau.textContent === texte) { return; } // rien à changer : on ne touche pas à la page
		if (n > 0) {
			sceau.textContent = n > 99 ? '99+' : String(n);
			sceau.removeAttribute('data-vide');
		} else {
			sceau.textContent = '';
			sceau.setAttribute('data-vide', '');
		}
	}

	function initCompteurs() {
		function compter() {
			var lettres = $('.toread-message');
			var icone = document.getElementById('i_icon_mini_new_message');
			majSceau('lettres', lireNombre(lettres ? lettres.textContent : (icone ? icone.getAttribute('alt') : '')));
			var avis = document.getElementById('notif_unread');
			majSceau('avis', lireNombre(avis ? avis.textContent : ''));
		}
		compter();

		// La barre Forumactif peut arriver après la page, et ses nombres changent en direct
		var prevu = false;
		new MutationObserver(function (changements) {
			if (prevu) { return; }
			// Les changements du thème lui-même (barre, panneau) ne comptent pas
			var utiles = changements.some(function (c) {
				var el = c.target.nodeType === 1 ? c.target : c.target.parentElement;
				return el && !el.closest('#barre-1740, #panneau-avis-1740');
			});
			if (!utiles) { return; }
			prevu = true;
			window.setTimeout(function () { prevu = false; compter(); }, 400);
		}).observe(document.body, { childList: true, subtree: true, characterData: true });
	}

	/* ------------------------------------------------------------------
	   2 ter. Panneau des avis
	   La barre Forumactif est masquée par le CSS, mais reste dans la page :
	   c'est elle qui reçoit les notifications (#notif_list) et les marque lues.
	   Le panneau du thème en affiche une copie à côté de la barre d'outils.
	   ------------------------------------------------------------------ */
	function initPanneauAvis() {
		var bouton = $('#barre-1740 [data-outil="avis"]');
		if (!bouton) { return; }

		var panneau = document.createElement('div');
		panneau.id = 'panneau-avis-1740';
		panneau.setAttribute('role', 'dialog');
		panneau.setAttribute('aria-label', 'Avis');
		panneau.hidden = true;
		panneau.innerHTML =
			'<div class="pa-tete">' +
				'<span class="pa-titre">Avis</span>' +
				'<a class="pa-tout" href="/profile?mode=editprofile&amp;page_profil=notifications">tout voir</a>' +
				'<button type="button" class="pa-fermer" aria-label="Fermer">\u00D7</button>' +
			'</div>' +
			'<ul class="pa-liste"></ul>';
		document.body.appendChild(panneau);
		var liste = $('.pa-liste', panneau);
		var nonLus = {};

		function sources() {
			return $$('#notif_list > li').filter(function (li) { return /^n\d+$/.test(li.id); });
		}

		function rendre() {
			var items = sources().reverse(); // les plus récents d'abord
			liste.innerHTML = '';
			if (!items.length) {
				var vide = document.createElement('li');
				vide.className = 'pa-vide';
				vide.textContent = 'Aucun avis pour l\u2019instant.';
				liste.appendChild(vide);
				return;
			}
			items.forEach(function (li) {
				var texte = $('.contentText', li);
				var heure = $('.contentTime', li);
				var suppr = $('a.delete', li);
				var el = document.createElement('li');
				el.className = 'pa-avis' + (nonLus[li.id] ? ' est-non-lu' : '');
				var t = document.createElement('div');
				t.className = 'pa-texte';
				if (texte) { Array.prototype.forEach.call(texte.childNodes, function (n) { t.appendChild(n.cloneNode(true)); }); }
				var h = document.createElement('div');
				h.className = 'pa-heure';
				h.textContent = heure ? heure.textContent : '';
				el.appendChild(t);
				el.appendChild(h);
				if (suppr) {
					var b = document.createElement('button');
					b.type = 'button';
					b.className = 'pa-suppr';
					b.setAttribute('aria-label', 'Supprimer cet avis');
					b.textContent = '\u00D7';
					b.addEventListener('click', function (e) {
						e.preventDefault();
						e.stopPropagation();
						suppr.click(); // Forumactif supprime l'avis de son côté
						if (el.parentNode) { el.parentNode.removeChild(el); }
					});
					el.appendChild(b);
				}
				liste.appendChild(el);
			});
		}

		function placer() {
			panneau.style.left = '';
			panneau.style.top = '';
			if (window.innerWidth <= 1100) { return; } // petits écrans : position gérée par le CSS
			var r = bouton.getBoundingClientRect();
			panneau.style.left = (r.right + 14) + 'px';
			var haut = Math.max(12, Math.min(r.top - 10, window.innerHeight - panneau.offsetHeight - 12));
			panneau.style.top = haut + 'px';
		}

		// Ouvre la liste Forumactif (invisible) : c'est ce qui marque les avis comme lus
		function marquerLus() {
			var natif = document.getElementById('fa_notifications');
			var listeNative = document.getElementById('notif_list');
			if (!natif) { return; }
			if (listeNative && listeNative.style.display === 'block') { natif.click(); }
			natif.click();
		}

		function ouvrir() {
			nonLus = {};
			$$('#notif_list > li.unread').forEach(function (li) { nonLus[li.id] = true; });
			rendre();
			// Avant d'afficher le panneau : le clic envoyé à Forumactif remonte jusqu'à la page
			// et fermerait sinon le panneau aussitôt
			marquerLus();
			panneau.hidden = false;
			bouton.setAttribute('aria-expanded', 'true');
			placer();
		}

		function fermer() {
			panneau.hidden = true;
			bouton.setAttribute('aria-expanded', 'false');
		}

		bouton.setAttribute('aria-haspopup', 'dialog');
		bouton.setAttribute('aria-expanded', 'false');
		bouton.addEventListener('click', function (e) {
			e.preventDefault();
			e.stopPropagation();
			if (panneau.hidden) { ouvrir(); } else { fermer(); }
		});
		$('.pa-fermer', panneau).addEventListener('click', fermer);
		panneau.addEventListener('click', function (e) { e.stopPropagation(); });
		document.addEventListener('click', function () { if (!panneau.hidden) { fermer(); } });
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && !panneau.hidden) { fermer(); bouton.focus(); }
		});
		window.addEventListener('resize', function () { if (!panneau.hidden) { placer(); } });

		// Nouvel avis pendant que le panneau est ouvert : on le met à jour
		var prevu = false;
		new MutationObserver(function (changements) {
			if (panneau.hidden || prevu) { return; }
			// On ignore les changements faits dans le panneau lui-même
			var ailleurs = changements.some(function (c) {
				var el = c.target.nodeType === 1 ? c.target : c.target.parentElement;
				return el && !el.closest('#barre-1740, #panneau-avis-1740');
			});
			if (!ailleurs) { return; }
			prevu = true;
			window.setTimeout(function () { prevu = false; if (!panneau.hidden) { rendre(); placer(); } }, 400);
		}).observe(document.body, { childList: true, subtree: true });
	}

	/* ------------------------------------------------------------------
	   3. Musique (un clic pour lancer ou couper)
	   ------------------------------------------------------------------ */
	function initMusique() {
		var bouton = $('.musique-1740');
		if (!bouton) { return; }
		if (!CONFIG.musique) { bouton.hidden = true; return; }

		var audio = new Audio(CONFIG.musique);
		audio.loop = true;
		audio.preload = 'none';
		audio.volume = 0;
		var cible = typeof CONFIG.volumeMusique === 'number' ? CONFIG.volumeMusique : 0.5;
		var minuterie = null;

		function fondu(vers, fin) {
			clearInterval(minuterie);
			minuterie = setInterval(function () {
				var v = audio.volume + (vers > audio.volume ? 0.04 : -0.04);
				if ((vers > audio.volume && v >= vers) || (vers <= audio.volume && v <= vers)) {
					audio.volume = Math.max(0, Math.min(1, vers));
					clearInterval(minuterie);
					if (fin) { fin(); }
				} else {
					audio.volume = Math.max(0, Math.min(1, v));
				}
			}, 60);
		}

		bouton.addEventListener('click', function () {
			var joue = bouton.getAttribute('aria-pressed') === 'true';
			if (joue) {
				bouton.setAttribute('aria-pressed', 'false');
				bouton.setAttribute('aria-label', 'Jouer l’air de veillée');
				bouton.title = 'Jouer l’air de veillée';
				fondu(0, function () { audio.pause(); });
			} else {
				bouton.setAttribute('aria-pressed', 'true');
				bouton.setAttribute('aria-label', 'Couper l’air de veillée');
				bouton.title = 'Couper l’air de veillée';
				var p = audio.play();
				if (p && p.catch) { p.catch(function () { bouton.setAttribute('aria-pressed', 'false'); }); }
				fondu(cible);
			}
		});
	}

	/* ------------------------------------------------------------------
	   4. Accueil : courroux et rumeurs
	   ------------------------------------------------------------------ */
	function initCourroux() {
		var jauge = $('#accueil-1740 .jauge');
		if (!jauge) { return; }
		var niveau = Math.max(0, Math.min(10, parseInt(jauge.getAttribute('data-niveau'), 10) || 0));
		jauge.setAttribute('aria-label', 'Courroux des créatures : ' + niveau + ' sur 10');
		var cases = $$('span', jauge);
		cases.forEach(function (c, i) {
			c.classList.toggle('rempli', i < niveau);
			c.classList.toggle('braise', i === niveau - 1);
		});
		if (niveau >= 5) { jauge.classList.add('fremit'); }
	}

	function initRumeurs() {
		var rumeurs = $$('#accueil-1740 .rumeur');
		if (!rumeurs.length) { return; }
		var reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduit || rumeurs.length === 1) {
			rumeurs.forEach(function (r) { r.classList.add('visible'); });
			return;
		}
		var i = 0;
		var duree = (CONFIG.dureeRumeur || 6) * 1000;
		function suivante() {
			rumeurs.forEach(function (r, j) { r.classList.toggle('visible', j === i); });
			i = (i + 1) % rumeurs.length;
		}
		suivante();
		setInterval(suivante, duree);
	}

	/* ------------------------------------------------------------------
	   5. Dates Forumactif → horodatage (pour trier les derniers écrits)
	   ------------------------------------------------------------------ */
	var MOIS = { jan: 0, 'fév': 1, fev: 1, mar: 2, avr: 3, mai: 4, juin: 5, juil: 6, 'aoû': 7, aou: 7, sep: 8, oct: 9, nov: 10, 'déc': 11, dec: 11 };

	function lireDate(texte) {
		if (!texte) { return 0; }
		var t = texte.toLowerCase();
		var heure = t.match(/(\d{1,2}):(\d{2})/);
		var h = heure ? parseInt(heure[1], 10) : 0;
		var m = heure ? parseInt(heure[2], 10) : 0;
		var d = new Date();
		if (t.indexOf('aujourd') > -1) { d.setHours(h, m, 0, 0); return d.getTime(); }
		if (t.indexOf('hier') > -1) { d.setDate(d.getDate() - 1); d.setHours(h, m, 0, 0); return d.getTime(); }
		var j = t.match(/(\d{1,2})\s+([a-zéû]+)\.?\s*(\d{4})?/);
		if (j) {
			var cleMois = j[2].slice(0, 4);
			var mois = MOIS[cleMois];
			if (mois === undefined) { mois = MOIS[j[2].slice(0, 3)]; }
			if (mois !== undefined) {
				var an = j[3] ? parseInt(j[3], 10) : d.getFullYear();
				return new Date(an, mois, parseInt(j[1], 10), h, m).getTime();
			}
		}
		return 0;
	}

	/* ------------------------------------------------------------------
	   6. Rangées de forums
	   ------------------------------------------------------------------ */
	var ICONES = window.FA_ICONES_1740 || {};
	var ecrits = [];

	function memeImage(a, b) {
		if (!a || !b) { return false; }
		var fa = a.split('/').pop().split('?')[0];
		var fb = b.split('/').pop().split('?')[0];
		return a === b || (fa && fa === fb);
	}

	function preparerForum(li) {
		// État : nouveau, lu ou scellé (comparaison avec les icônes de la légende)
		var icone = li.getAttribute('data-icone') || '';
		var etat = 'lu';
		if (memeImage(icone, ICONES.nouveau)) { etat = 'nouveau'; }
		else if (memeImage(icone, ICONES.scelle)) { etat = 'scelle'; }
		li.classList.add('est-' + etat);

		// Identifiant du forum et vignette
		var lien = $('.forum-titre a', li);
		var id = lien ? (lien.getAttribute('href').match(/\/f(\d+)-/) || [])[1] : null;
		if (id) { li.setAttribute('data-forum', id); }
		var vignette = $('.forum-vignette', li);
		var vignettes = CONFIG.vignettes || {};
		if (vignette) {
			var src = (id && vignettes[id]) || CONFIG.vignetteParDefaut;
			if (src) {
				var img = document.createElement('img');
				img.src = src; img.alt = ''; img.loading = 'lazy';
				vignette.appendChild(img);
			}
		}

		// Sous-forums : on garde seulement les liens (Forumactif ajoute des virgules).
		// Selon la version, Forumactif les place dans SUBFORUMS ou dans LINKS : on cherche aux deux endroits.
		var sous = $('.forum-sous', li);
		var moderateurs = $('.forum-moderateurs', li);
		if (sous) {
			var liens = $$('a', sous);
			if (moderateurs) {
				$$('a', moderateurs).forEach(function (a) {
					if (/\/f\d+/.test(a.getAttribute('href') || '')) { liens.push(a); }
				});
				// S'il ne reste que des étiquettes (« Sous-forums : », virgules), on vide la zone
				if (!$$('a', moderateurs).filter(function (a) { return !/\/f\d+/.test(a.getAttribute('href') || ''); }).length) {
					moderateurs.innerHTML = '';
				}
			}
			sous.innerHTML = '';
			var romains = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
			liens.forEach(function (a, i) {
				a.className = '';
				a.setAttribute('data-numero', romains[i] || String(i + 1));
				sous.appendChild(a);
			});
		}

		// Dernier message : avatar, sujet, auteur · date, flèche
		var par = $('.dernier-par', li);
		var fleche = $('.dernier-fleche', li);
		var sujet = $('.dernier-sujet', li);
		var avatarImg = $('.dernier-avatar img', li);
		if (par) {
			var liensPar = $$('a', par);
			var auteur = null, message = null;
			liensPar.forEach(function (a) {
				var href = a.getAttribute('href') || '';
				if (/\/u\d+/.test(href)) { auteur = a; }
				else if (/\/t\d+/.test(href) || href.indexOf('#') > -1 || /\/viewtopic/.test(href)) { message = a; }
			});
			// Date = tout le texte, moins les liens (le pseudo peut être emballé dans un <span> ou <strong>)
			var copie = par.cloneNode(true);
			Array.prototype.forEach.call(copie.querySelectorAll('a, img'), function (n) { n.parentNode.removeChild(n); });
			var dateTexte = copie.textContent.replace(/\s+/g, ' ').replace(/\b(par|by)\s*$/i, '').replace(/^(par|by)\s+/i, '').trim();

			if (!auteur) {
				li.classList.add('sans-message');
				var ligneVide = $('.dernier-ligne', li);
				if (ligneVide) { ligneVide.innerHTML = '<span class="dernier-vide">Aucun écrit pour l’instant</span>'; }
				placerEtat(li);
				return;
			}

			par.innerHTML = '';
			auteur.className = '';
			var zoneAuteur = document.createElement('span');
			zoneAuteur.className = 'dernier-auteur';
			zoneAuteur.appendChild(auteur);
			par.appendChild(zoneAuteur);
			if (dateTexte) {
				var zoneDate = document.createElement('span');
				zoneDate.className = 'dernier-date';
				zoneDate.textContent = dateTexte;
				par.appendChild(zoneDate);
			}
			if (fleche) {
				if (message) { fleche.href = message.href; }
				else if (sujet) { fleche.href = sujet.href; }
			}

			ecrits.push({
				titre: sujet ? sujet.textContent : '',
				titreComplet: sujet ? (sujet.getAttribute('title') || sujet.textContent) : '',
				lien: fleche ? fleche.href : (sujet ? sujet.href : '#'),
				auteur: auteur.textContent,
				lienAuteur: auteur.href,
				date: dateTexte,
				quand: lireDate(dateTexte),
				avatar: avatarImg ? avatarImg.src : ''
			});
		}
		placerEtat(li);
	}

	// Accord des statistiques : « 1 sujet », « 0 sujet », « 2 sujets »
	function accorderStats(li) {
		$$('.forum-stats .nb', li).forEach(function (nb) {
			var mot = nb.nextElementSibling;
			var n = parseInt(nb.textContent.replace(/\D/g, ''), 10) || 0;
			if (mot && mot.classList.contains('mot') && n <= 1) { mot.textContent = mot.getAttribute('data-un'); }
		});
	}

	// Dans le Grimoire et le coin du feu, l'icône d'état va à côté de l'avatar du dernier posteur
	function placerEtat(li) {
		var ch = li.closest('.chapitre-1740');
		var g = ch ? ch.getAttribute('data-gabarit') : '';
		var premier = ch && $('.forum-1740', ch) === li;
		// Greffe : l'icône reste à gauche et les statistiques restent dans la colonne de droite
		if (g === 'greffe') { return; }
		if (!((g === 'fondements' && premier) || g === 'feu')) { return; }
		var etat = $(':scope > .etat-1740', li);
		var ligne = $('.dernier-ligne', li);
		if (etat && ligne) { ligne.insertBefore(etat, ligne.firstChild); etat.style.display = 'block'; }
	}

	// Tuiles du Grimoire : liens directs vers des sujets
	function creerTuiles(li, tuiles) {
		var romains = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
		var zone = document.createElement('div');
		zone.className = 'tuiles-1740';
		tuiles.forEach(function (t, i) {
			var a = document.createElement('a');
			a.href = t.lien;
			var num = document.createElement('span');
			num.className = 'numero';
			num.textContent = romains[i] || String(i + 1);
			var nom = document.createElement('span');
			nom.textContent = t.titre;
			a.appendChild(num); a.appendChild(nom);
			zone.appendChild(a);
		});
		var infos = $('.forum-infos', li);
		var sous = $('.forum-sous', li);
		if (sous) { sous.style.display = 'none'; }
		if (infos) { infos.appendChild(zone); }
	}

	/* ------------------------------------------------------------------
	   7. Chapitres : gabarits, panneaux, bandeau
	   ------------------------------------------------------------------ */
	function creerPanneau(reglage, classeImage) {
		var a = document.createElement('a');
		a.className = 'chapitre-panneau';
		a.href = (reglage && reglage.lien) || '#';
		if (classeImage) { a.style.backgroundImage = classeImage; }
		var sous = document.createElement('span');
		sous.className = 'sous';
		sous.textContent = (reglage && reglage.sous) || '';
		a.appendChild(sous);
		if (reglage && reglage.titre) {
			var titre = document.createElement('span');
			titre.className = 'titre';
			titre.textContent = reglage.titre;
			a.appendChild(titre);
		}
		if (!reglage || !reglage.lien) { a.setAttribute('tabindex', '-1'); a.setAttribute('aria-hidden', 'true'); a.removeAttribute('href'); }
		if (reglage && reglage.image) { a.style.backgroundImage = 'url("' + reglage.image + '")'; }
		return a;
	}

	function initChapitres() {
		var chapitres = $$('.chapitre-1740');
		var reglages = CONFIG.chapitres || [];
		chapitres.forEach(function (ch, i) {
			var r = reglages[i] || {};
			var gabarit = r.gabarit || 'terres';
			ch.setAttribute('data-gabarit', gabarit);
			var surtitre = $('.chapitre-surtitre', ch);
			if (surtitre && r.surtitre) { surtitre.textContent = r.surtitre; }

			var corps = $('.chapitre-corps', ch);
			var liste = $('.chapitre-forums', ch);
			if (!corps || !liste) { return; }

			if (gabarit === 'fondements') {
				corps.appendChild(creerPanneau(r.panneau));
				var premier = $('.forum-1740', liste);
				if (premier && r.tuiles && r.tuiles.length) { creerTuiles(premier, r.tuiles); }
			} else if (gabarit === 'terres') {
				if (r.bandeau !== false) {
					var bandeau = document.createElement('div');
					bandeau.className = 'chapitre-bandeau';
					var p = document.createElement('p');
					p.textContent = r.bandeau || '';
					bandeau.appendChild(p);
					corps.insertBefore(bandeau, liste);
				}
			} else if (gabarit === 'feu') {
				corps.insertBefore(creerPanneau(r.panneau), liste);
				var droite = document.createElement('div');
				droite.className = 'feu-droite';
				corps.insertBefore(droite, liste);
				droite.appendChild(liste);
				var presences = $('#presences-1740');
				var legende = $('#legende-1740');
				if (presences) { droite.appendChild(presences); }
				if (legende) {
					// On rapatrie les liens « sujets actifs / top des posteurs » de l'index
					var zoneLiens = $('.liens', legende);
					$$('ul.linklist.bottom li:not(.rightside) a').forEach(function (a) {
						if (zoneLiens) { zoneLiens.appendChild(a); }
					});
					droite.appendChild(legende);
				}
			}
		});

		// Si aucun chapitre « feu » n'existe, on affiche les présences sous l'index
		var presencesOrphelines = $('#presences-source-1740 #presences-1740');
		var source = $('#presences-source-1740');
		if (presencesOrphelines && source) { source.style.display = 'block'; source.classList.add('boite-1740'); }

		$$('.forum-1740').forEach(function (li) { accorderStats(li); preparerForum(li); });
	}

	/* ------------------------------------------------------------------
	   8. Derniers écrits (construits à partir des derniers messages de chaque forum)
	   ------------------------------------------------------------------ */
	function echapper(s) {
		return String(s).replace(/[&<>"']/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
		});
	}

	function initDerniersEcrits() {
		var zone = $('#accueil-1740 .derniers');
		if (!zone) { return; }
		ecrits.sort(function (a, b) { return b.quand - a.quand; });
		var liste = ecrits.slice(0, CONFIG.nbDerniersEcrits || 6);
		if (!liste.length) {
			zone.innerHTML = '<p class="derniers-vide">Rien n’a encore été écrit.</p>';
			return;
		}
		zone.innerHTML = liste.map(function (e) {
			var avatar = e.avatar
				? '<img class="avatar-rond-1740" src="' + echapper(e.avatar) + '" alt="" loading="lazy">'
				: '<span class="avatar-rond-1740" aria-hidden="true"></span>';
			return '<div class="ecrit">' + avatar +
				'<div class="ecrit-infos"><a class="ecrit-titre" href="' + echapper(e.lien) + '" title="' + echapper(e.titreComplet) + '">' + echapper(e.titre) + '</a>' +
				'<span class="ecrit-meta">' + echapper(e.auteur) + ' · ' + echapper(e.date) + '</span></div>' +
				'<a class="ecrit-fleche" href="' + echapper(e.lien) + '" aria-label="Aller au dernier message">→</a></div>';
		}).join('');
	}

	/* ------------------------------------------------------------------
	   9. Présences : statistiques et dernière venue (lues dans le pied de page)
	   ------------------------------------------------------------------ */
	// Sur une page de profil, trouve l'image qui est vraiment l'avatar :
	// on écarte les icônes (genre, rang, boutons, émoticônes) et on favorise
	// les images marquées « avatar » ou portant le pseudo du membre.
	function choisirAvatar(doc, pseudo) {
		var meilleure = null, meilleurScore = 0;
		var nom = pseudo.toLowerCase();
		Array.prototype.forEach.call(doc.querySelectorAll('img'), function (img) {
			var src = (img.getAttribute('src') || '').toLowerCase();
			var alt = (img.getAttribute('alt') || '').toLowerCase();
			var classes = ((img.className || '') + ' ' + (img.parentElement ? img.parentElement.className : '')).toLowerCase();
			if (!src || /gender|genre|sexe|male|female|rank|rang|icon|ion-|smilies|smiley|emoji|button|bouton|logo|pixel|spacer|blank/.test(src + ' ' + classes)) { return; }
			var w = parseInt(img.getAttribute('width'), 10) || 0;
			var h = parseInt(img.getAttribute('height'), 10) || 0;
			if ((w && w < 40) || (h && h < 40)) { return; }
			var score = 1;
			if (/avatar/.test(src + ' ' + classes + ' ' + alt)) { score += 5; }
			if (nom && alt.indexOf(nom) > -1) { score += 4; }
			if (img.closest('#profile-advanced-right, .profile-avatar, .mod-login-avatar, .module')) { score += 2; }
			if (/\.gif(\?|$)/.test(src)) { score -= 1; }
			if (score > meilleurScore) { meilleurScore = score; meilleure = img; }
		});
		return meilleurScore >= 3 ? meilleure : null;
	}

	function initStatistiques() {
		var bloc = $('#presences-1740');
		if (!bloc) { return; }
		var texte = document.body.textContent || '';
		var messages = texte.match(/total de\s*([\d\s .]+)\s*messages?/i);
		var membres = texte.match(/avons\s*([\d\s .]+)\s*membres?/i);
		if (messages) { $('[data-stat="messages"]', bloc).textContent = messages[1].replace(/\D/g, ''); }
		if (membres) { $('[data-stat="membres"]', bloc).textContent = membres[1].replace(/\D/g, ''); }

		// Dernière inscription : on cherche le lien qui suit « plus récent »
		var cible = null;
		$$('a[href*="/u"]').forEach(function (a) {
			if (cible || a.closest('#presences-1740') || a.closest('.chapitre-1740') || a.closest('#accueil-1740')) { return; }
			var parent = a.parentElement;
			for (var n = 0; n < 3 && parent; n++) {
				if (/plus r[ée]cent/i.test(parent.textContent)) { cible = a; break; }
				parent = parent.parentElement;
			}
		});
		var venue = $('.venue', bloc);
		if (!cible || !venue) { if (venue) { venue.style.display = 'none'; } return; }

		var lienNom = $('.venue-nom a', venue);
		lienNom.textContent = cible.textContent.trim();
		lienNom.href = cible.href;
		$('.venue-bienvenue', venue).href = cible.href;

		// Avatar : lu sur la page de profil (gardé en mémoire pour la session)
		var cle = 'avatar1740b_' + cible.getAttribute('href');
		var enCache = null;
		try { enCache = window.sessionStorage.getItem(cle); } catch (e) { enCache = null; }
		var img = $('.venue-ligne img', venue);
		if (enCache) { img.src = enCache; return; }
		fetch(cible.href, { credentials: 'same-origin' }).then(function (r) { return r.text(); }).then(function (html) {
			var doc = new DOMParser().parseFromString(html, 'text/html');
			var trouve = choisirAvatar(doc, cible.textContent.trim());
			if (trouve && trouve.getAttribute('src')) {
				img.src = trouve.getAttribute('src');
				try { window.sessionStorage.setItem(cle, img.src); } catch (e) { /* rien */ }
			}
		}).catch(function () { /* l'image de remplacement reste */ });
	}

	/* ------------------------------------------------------------------
	   10. Pied de page : on masque le bandeau de statistiques de Forumactif
	       (déjà affiché dans le coin du feu). Les liens légaux restent visibles.
	   ------------------------------------------------------------------ */
	function nettoyerPresents() {
		var zone = $('#presences-1740 .presents');
		if (!zone) { return; }
		var liens = $$('a', zone);
		zone.innerHTML = '';
		liens.forEach(function (a, i) {
			if (i) { zone.appendChild(document.createTextNode(', ')); }
			zone.appendChild(a);
		});
	}

	// Les liens de recherche (nouveaux messages, sans réponse…) rejoignent le bas de l'accueil
	function deplacerRaccourcis() {
		var liste = $('ul.linklist.top');
		var accueil = $('#accueil-1740');
		if (liste && accueil) { accueil.appendChild(liste); }
	}

	function initPied() {
		// Sur l'index, les statistiques sont déjà dans le coin du feu : on masque le bandeau natif
		if ($('#presences-1740')) { document.documentElement.classList.add('index-1740'); }
	}

	/* ------------------------------------------------------------------
	   Démarrage
	   ------------------------------------------------------------------ */
	function demarrer() {
		document.documentElement.classList.add('theme-1740');
		lireReglages();
		initThemes();
		initMembre();
		initMusique();
		initCourroux();
		initRumeurs();
		if ($('.chapitre-1740')) {
			initChapitres();
			initDerniersEcrits();
		}
		initStatistiques();
		nettoyerPresents();
		deplacerRaccourcis();
		initPied();
	}

	if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', demarrer); }
	else { demarrer(); }
})();
