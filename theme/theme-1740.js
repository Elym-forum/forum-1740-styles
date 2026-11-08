/* ==========================================================================
   FORUM 1740 \u2014 SCRIPT DU THÈME (© Elym)
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
		if (attr('data-ambiance')) { CONFIG.ambiance = attr('data-ambiance'); }
		if (attr('data-corbeaux')) { CONFIG.corbeaux = attr('data-corbeaux').split(',').map(function (u) { return u.trim(); }).filter(Boolean); }
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

		if (connecte) { initCompteurs(); initPanneauAvis(); initPanneauComptes(); }
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
		var avisAvant = null;
		var lettresDistantes = null; // nombre relu sur le serveur après un nouvel avis
		function compter() {
			var lettres = $('.toread-message');
			var icone = document.getElementById('i_icon_mini_new_message');
			var nbLettres = lireNombre(lettres ? lettres.textContent : (icone ? icone.getAttribute('alt') : ''));
			if (lettresDistantes !== null && lettresDistantes > nbLettres) { nbLettres = lettresDistantes; }
			majSceau('lettres', nbLettres);
			var avis = document.getElementById('notif_unread');
			var nbAvis = lireNombre(avis ? avis.textContent : '');
			majSceau('avis', nbAvis);
			// Un avis vient d'arriver en direct : c'est peut-être une lettre. Forumactif ne met pas
			// à jour le compteur des messages privés sans recharger la page : on va le relire.
			if (avisAvant !== null && nbAvis > avisAvant) { relireLettres(); }
			avisAvant = nbAvis;
		}
		function relireLettres() {
			if (!window.fetch || !window.DOMParser) { return; }
			fetch('/privmsg?folder=inbox', { credentials: 'same-origin' })
				.then(function (r) { return r.text(); })
				.then(function (html) {
					var doc = new DOMParser().parseFromString(html, 'text/html');
					var ic = doc.getElementById('i_icon_mini_new_message');
					var tr = doc.querySelector('.toread-message');
					var n = lireNombre(tr ? tr.textContent : (ic ? ic.getAttribute('alt') : ''));
					// Repli : on compte les lettres non lues de la boîte de réception
					if (!n) {
						n = Array.prototype.filter.call(doc.querySelectorAll('.lettre-1740'), function (li) {
							return /new|unread|non_?lu/i.test(li.getAttribute('data-icone') || '') || li.querySelector('.lettre-infos-1740 strong');
						}).length;
					}
					lettresDistantes = n;
					compter();
				})
				.catch(function () {});
		}
		compter();

		// La barre Forumactif peut arriver après la page, et ses nombres changent en direct
		var prevu = false;
		new MutationObserver(function (changements) {
			if (prevu) { return; }
			// Les changements du thème lui-même (barre, panneau) ne comptent pas
			var utiles = changements.some(function (c) {
				var el = c.target.nodeType === 1 ? c.target : c.target.parentElement;
				return el && !el.closest('#barre-1740, .panneau-1740');
			});
			if (!utiles) { return; }
			prevu = true;
			window.setTimeout(function () { prevu = false; compter(); }, 400);
		}).observe(document.body, { childList: true, subtree: true, characterData: true });
	}

	/* ------------------------------------------------------------------
	   Panneaux de la barre d'outils : outils communs
	   - un seul panneau ouvert à la fois
	   - placés à droite de la barre (ou au-dessus d'elle sur petit écran)
	   ------------------------------------------------------------------ */
	var fermeturesPanneaux = [];

	function fermerAutresPanneaux(sauf) {
		fermeturesPanneaux.forEach(function (f) { if (f !== sauf) { f(); } });
	}

	var ECART_PANNEAU = 20; // distance entre le bord de la barre et la boîte (px)
	function placerPanneau(panneau, bouton) {
		panneau.style.left = '';
		panneau.style.top = '';
		panneau.style.bottom = '';
		if (window.innerWidth <= 1100) { return; } // petits écrans : position gérée par le CSS
		var r = bouton.getBoundingClientRect();
		var barre = document.getElementById('barre-1740');
		var droite = barre ? barre.getBoundingClientRect().right : r.right;
		// + 4 px : le double filet de la boîte (outline) dépasse de 4 px vers l'extérieur
		panneau.style.left = (droite + ECART_PANNEAU + 4) + 'px';
		// La boîte s'aligne sur le haut du bouton. Si elle dépasserait en bas de l'écran,
		// on l'accroche plutôt par le bas du bouton : elle grandit alors vers le haut.
		if (r.top - 10 + panneau.offsetHeight > window.innerHeight - 12) {
			panneau.style.top = 'auto';
			panneau.style.bottom = Math.max(12, window.innerHeight - r.bottom - 10) + 'px';
		} else {
			panneau.style.top = Math.max(12, r.top - 10) + 'px';
		}
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
		panneau.className = 'panneau-1740';
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

		function placer() { placerPanneau(panneau, bouton); }

		// Ouvre la liste Forumactif (invisible) : c'est ce qui marque les avis comme lus
		function marquerLus() {
			var natif = document.getElementById('fa_notifications');
			var listeNative = document.getElementById('notif_list');
			if (!natif) { return; }
			if (listeNative && listeNative.style.display === 'block') { natif.click(); }
			natif.click();
		}

		function ouvrir() {
			fermerAutresPanneaux(fermer);
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

		fermeturesPanneaux.push(fermer);
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
				return el && !el.closest('#barre-1740, .panneau-1740');
			});
			if (!ailleurs) { return; }
			prevu = true;
			window.setTimeout(function () { prevu = false; if (!panneau.hidden) { rendre(); placer(); } }, 400);
		}).observe(document.body, { childList: true, subtree: true });
	}

	/* ------------------------------------------------------------------
	   2 quater. Changer de personnage (multicomptes)
	   Forumactif n'a pas de vraie fonction multicomptes : pour changer de
	   compte, on se déconnecte puis on se reconnecte avec le mot de passe du
	   personnage choisi. Les comptes sont gardés dans ce navigateur
	   (localStorage « comptes1740 »), mots de passe en clair, à la demande
	   de l'administration ; une mise en garde l'indique dans le panneau.
	   ------------------------------------------------------------------ */
	var CLE_COMPTES = 'comptes1740';

	function lireComptes() {
		try {
			var liste = JSON.parse(lireStockage(CLE_COMPTES) || '[]');
			return Array.isArray(liste) ? liste.filter(function (c) { return c && c.nom; }) : [];
		} catch (e) { return []; }
	}
	function ecrireComptes(liste) { ecrireStockage(CLE_COMPTES, JSON.stringify(liste)); }
	function memeNom(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); }

	// Lit, dans le code d'une page Forumactif, le pseudo du membre connecté
	function pseudoDansPage(html) {
		var connecte = /session_logged_in["'\]]*\s*[:=]\s*["']?1/.test(html);
		if (!connecte) { return ''; }
		var m = html.match(/["']?username["'\]]*\s*[:=]\s*["']([^"']*)["']/);
		return m ? m[1] : '';
	}

	function deconnecterCompte() {
		var liens = $$('a[href*="logout"]');
		var lien = liens.filter(function (a) { return /tid=/.test(a.href); })[0] || liens[0];
		var url = lien ? lien.href : '/login?logout=1';
		return fetch(url, { credentials: 'same-origin' }).catch(function () { /* on continue */ });
	}

	function connecterCompte(compte) {
		var corps = new URLSearchParams();
		corps.set('username', compte.nom);
		corps.set('password', compte.mdp || '');
		corps.set('autologin', 'on');
		corps.set('redirect', '');
		corps.set('login', 'Connexion');
		return fetch('/login', {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: corps.toString()
		}).then(function () {
			// Vérification : qui est connecté maintenant ?
			return fetch('/', { credentials: 'same-origin', cache: 'no-store' });
		}).then(function (r) { return r.text(); }).then(function (html) {
			return memeNom(pseudoDansPage(html), compte.nom);
		}).catch(function () { return false; });
	}

	function initPanneauComptes() {
		var bouton = $('#barre-1740 [data-outil="personnage"]');
		if (!bouton) { return; }
		var u = window._userdata || {};

		// Le compte actuel, s'il est enregistré, met à jour son avatar et son numéro
		var comptes = lireComptes();
		comptes.forEach(function (c) {
			if (memeNom(c.nom, u.username)) {
				c.nom = u.username;
				if (u.avatar_link) { c.avatar = u.avatar_link; }
				if (u.user_id) { c.id = u.user_id; }
			}
		});
		ecrireComptes(comptes);

		var panneau = document.createElement('div');
		panneau.id = 'panneau-comptes-1740';
		panneau.className = 'panneau-1740';
		panneau.setAttribute('role', 'dialog');
		panneau.setAttribute('aria-label', 'Changer de personnage');
		panneau.hidden = true;
		panneau.innerHTML =
			'<div class="pa-tete">' +
				'<span class="pa-titre">Personnages</span>' +
				'<button type="button" class="pa-fermer" aria-label="Fermer">\u00D7</button>' +
			'</div>' +
			'<ul class="pa-liste pc-liste"></ul>' +
			'<details class="pc-ajout">' +
				'<summary>Ajouter un personnage</summary>' +
				'<form class="pc-formulaire" autocomplete="off">' +
					'<label>Pseudo<input type="text" name="pseudo" required></label>' +
					'<label>Mot de passe<input type="password" name="mdp" autocomplete="new-password" required></label>' +
					'<button type="submit" class="pc-bouton">Ajouter</button>' +
				'</form>' +
				'<p class="pc-avertissement">Les mots de passe sont gard\u00E9s dans ce navigateur, sans chiffrement. N\u2019utilise pas ce widget sur un ordinateur partag\u00E9.</p>' +
			'</details>' +
			'<p class="pc-etat" aria-live="polite"></p>';
		document.body.appendChild(panneau);

		var liste = $('.pc-liste', panneau);
		var formulaire = $('.pc-formulaire', panneau);
		var zoneEtat = $('.pc-etat', panneau);
		var occupe = false;

		function etat(texte) { zoneEtat.textContent = texte || ''; }

		function avatarDe(c) {
			var span = document.createElement('span');
			span.className = 'pc-avatar';
			if (c.avatar) {
				var img = document.createElement('img');
				img.src = c.avatar; img.alt = ''; img.loading = 'lazy';
				span.appendChild(img);
			} else {
				span.textContent = (c.nom || '?').trim().charAt(0).toUpperCase();
			}
			return span;
		}

		function rendre() {
			comptes = lireComptes();
			liste.innerHTML = '';
			if (!comptes.length) {
				var vide = document.createElement('li');
				vide.className = 'pa-vide';
				vide.textContent = 'Aucun personnage enregistr\u00E9. Ajoute tes comptes ci-dessous.';
				liste.appendChild(vide);
			}
			comptes.forEach(function (c, i) {
				var actuel = memeNom(c.nom, u.username);
				var li = document.createElement('li');
				li.className = 'pa-avis pc-compte' + (actuel ? ' est-actuel' : '');
				var choisir = document.createElement('button');
				choisir.type = 'button';
				choisir.className = 'pc-choisir';
				choisir.disabled = actuel || occupe;
				choisir.setAttribute('aria-label', actuel ? c.nom + ' (personnage actuel)' : 'Passer \u00E0 ' + c.nom);
				choisir.appendChild(avatarDe(c));
				var nom = document.createElement('span');
				nom.className = 'pc-nom';
				nom.textContent = c.nom;
				choisir.appendChild(nom);
				if (actuel) {
					var marque = document.createElement('span');
					marque.className = 'pc-marque';
					marque.textContent = 'actuel';
					choisir.appendChild(marque);
				}
				choisir.addEventListener('click', function () { changerVers(c); });
				li.appendChild(choisir);

				var retirer = document.createElement('button');
				retirer.type = 'button';
				retirer.className = 'pa-suppr';
				retirer.setAttribute('aria-label', 'Retirer ' + c.nom + ' de la liste');
				retirer.textContent = '\u00D7';
				retirer.addEventListener('click', function (e) {
					e.stopPropagation();
					var l = lireComptes();
					l.splice(i, 1);
					ecrireComptes(l);
					etat(c.nom + ' a \u00E9t\u00E9 retir\u00E9 de la liste.');
					rendre();
				});
				li.appendChild(retirer);
				liste.appendChild(li);
			});

			// Suggestion : le compte actuel, s'il n'est pas encore dans la liste
			var champPseudo = formulaire.elements.pseudo;
			if (!champPseudo.value && !comptes.some(function (c) { return memeNom(c.nom, u.username); })) {
				champPseudo.value = u.username || '';
			}
		}

		function changerVers(compte) {
			if (occupe) { return; }
			occupe = true;
			rendre();
			var precedent = lireComptes().filter(function (c) { return memeNom(c.nom, u.username); })[0];
			etat('Passage \u00E0 ' + compte.nom + '\u2026');
			deconnecterCompte().then(function () {
				return connecterCompte(compte);
			}).then(function (ok) {
				if (ok) { window.location.reload(); return null; }
				etat('Connexion refus\u00E9e pour ' + compte.nom + ' : v\u00E9rifie son mot de passe.');
				// On tente de revenir au compte de départ
				return precedent ? connecterCompte(precedent).then(function (retour) {
					if (retour) {
						etat('Connexion refus\u00E9e pour ' + compte.nom + ' : v\u00E9rifie son mot de passe. Retour sur le compte ' + precedent.nom + '.');
					} else {
						etat('Connexion refus\u00E9e, et le retour au compte pr\u00E9c\u00E9dent a \u00E9chou\u00E9. La session est ferm\u00E9e : reconnecte-toi.');
					}
					occupe = false;
					rendre();
				}) : (function () {
					etat('Connexion refus\u00E9e pour ' + compte.nom + '. La session est ferm\u00E9e : reconnecte-toi.');
					occupe = false;
					rendre();
				})();
			});
		}

		formulaire.addEventListener('submit', function (e) {
			e.preventDefault();
			var nom = formulaire.elements.pseudo.value.trim();
			var mdp = formulaire.elements.mdp.value;
			if (!nom || !mdp) { return; }
			var l = lireComptes();
			var existant = l.filter(function (c) { return memeNom(c.nom, nom); })[0];
			if (existant) {
				existant.mdp = mdp;
				etat('Mot de passe de ' + existant.nom + ' mis \u00E0 jour.');
			} else {
				var nouveau = { nom: nom, mdp: mdp };
				if (memeNom(nom, u.username)) {
					nouveau.nom = u.username;
					if (u.avatar_link) { nouveau.avatar = u.avatar_link; }
					if (u.user_id) { nouveau.id = u.user_id; }
				}
				l.push(nouveau);
				etat(nouveau.nom + ' a \u00E9t\u00E9 ajout\u00E9.');
			}
			ecrireComptes(l);
			formulaire.reset();
			rendre();
		});

		function ouvrir() {
			fermerAutresPanneaux(fermer);
			etat('');
			rendre();
			panneau.hidden = false;
			bouton.setAttribute('aria-expanded', 'true');
			placerPanneau(panneau, bouton);
		}
		function fermer() {
			panneau.hidden = true;
			bouton.setAttribute('aria-expanded', 'false');
		}

		fermeturesPanneaux.push(fermer);
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
		window.addEventListener('resize', function () { if (!panneau.hidden) { placerPanneau(panneau, bouton); } });
		// Le panneau change de hauteur quand on déplie « Ajouter » : on le replace
		$('.pc-ajout', panneau).addEventListener('toggle', function () { placerPanneau(panneau, bouton); });
	}

	/* ------------------------------------------------------------------
	   3. Musique (un clic pour lancer ou couper)
	   ------------------------------------------------------------------ */
	/* Ambiance sonore en couches : un bourdon (data-musique), une ambiance
	   de fond facultative (data-ambiance, ex. le vent) et des croassements
	   joués au hasard (data-corbeaux, adresses séparées par des virgules). */
	function initMusique() {
		var bouton = $('.musique-1740');
		if (!bouton) { return; }
		if (!CONFIG.musique) { bouton.hidden = true; return; }

		var volume = typeof CONFIG.volumeMusique === 'number' ? CONFIG.volumeMusique : 0.5;
		function piste(url, part) {
			var a = new Audio(url);
			a.loop = true;
			a.preload = 'none';
			a.volume = 0;
			return { audio: a, cible: Math.min(1, volume * part) };
		}
		var couches = [piste(CONFIG.musique, 1)];
		if (CONFIG.ambiance) { couches.push(piste(CONFIG.ambiance, 0.7)); }
		var corbeaux = (CONFIG.corbeaux || []).map(function (url) {
			var a = new Audio(url);
			a.preload = 'none';
			return a;
		});
		var enMarche = false;
		var minuterie = null;
		var prochainCorbeau = null;

		function fondu(monter, fin) {
			clearInterval(minuterie);
			var pas = 0;
			minuterie = setInterval(function () {
				pas++;
				var t = Math.min(1, pas / 40); // environ 2,4 secondes
				couches.forEach(function (c) {
					c.audio.volume = Math.max(0, Math.min(1, monter ? c.cible * t : c.audio.volume * (1 - t)));
				});
				if (t >= 1) { clearInterval(minuterie); if (fin) { fin(); } }
			}, 60);
		}

		function croasser() {
			if (!enMarche || !corbeaux.length) { return; }
			var a = corbeaux[Math.floor(Math.random() * corbeaux.length)];
			a.volume = Math.min(1, volume * (0.35 + Math.random() * 0.3)); // plus ou moins lointain
			a.currentTime = 0;
			var p = a.play();
			if (p && p.catch) { p.catch(function () {}); }
			// Parfois un second cri peu après, comme une réponse
			if (Math.random() < 0.3) {
				setTimeout(function () {
					if (!enMarche) { return; }
					var b = corbeaux[Math.floor(Math.random() * corbeaux.length)];
					if (b === a) { return; }
					b.volume = Math.min(1, volume * 0.3);
					b.currentTime = 0;
					var q = b.play();
					if (q && q.catch) { q.catch(function () {}); }
				}, 1500 + Math.random() * 2500);
			}
			planifierCorbeau();
		}
		function planifierCorbeau() {
			clearTimeout(prochainCorbeau);
			prochainCorbeau = setTimeout(croasser, 40000 + Math.random() * 50000); // 40 à 90 s
		}

		function etiquette(joue) {
			var texte = joue ? 'Couper l\u2019ambiance sonore' : 'Jouer l\u2019ambiance sonore';
			bouton.setAttribute('aria-pressed', joue ? 'true' : 'false');
			bouton.setAttribute('aria-label', texte);
			bouton.title = texte;
		}

		bouton.addEventListener('click', function () {
			if (enMarche) {
				enMarche = false;
				etiquette(false);
				clearTimeout(prochainCorbeau);
				fondu(false, function () { couches.forEach(function (c) { c.audio.pause(); }); });
			} else {
				enMarche = true;
				etiquette(true);
				couches.forEach(function (c) {
					var p = c.audio.play();
					if (p && p.catch) { p.catch(function () { enMarche = false; etiquette(false); }); }
				});
				fondu(true);
				// Premier cri assez tôt pour qu'on l'entende, puis au hasard
				clearTimeout(prochainCorbeau);
				prochainCorbeau = setTimeout(croasser, 12000 + Math.random() * 10000);
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
		if (mouvementReduit() || rumeurs.length === 1) {
			rumeurs.forEach(function (r) { r.classList.add('visible'); });
			return;
		}
		var i = 0;
		var duree = (CONFIG.dureeRumeur || 6) * 1000;
		function suivante() {
			if (mouvementReduit()) { return; } // animations réduites en cours de route : on fige la rumeur
			rumeurs.forEach(function (r, j) { r.classList.toggle('visible', j === i); });
			i = (i + 1) % rumeurs.length;
		}
		suivante();
		setInterval(suivante, duree);
	}

	/* ------------------------------------------------------------------
	   5. Dates Forumactif \u2192 horodatage (pour trier les derniers écrits)
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
	var ICONES = window.FA_ICONES_1740 || null;
	try {
		if (ICONES && ICONES.nouveau) { localStorage.setItem('icones1740', JSON.stringify(ICONES)); }
		else { ICONES = JSON.parse(localStorage.getItem('icones1740') || '{}'); }
	} catch (e) { ICONES = ICONES || {}; }
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
		// 1) icônes de la légende ; 2) à défaut, le nom de l'image de Forumactif (forum_unread\u2026, \u2026_locked\u2026)
		if (memeImage(icone, ICONES.nouveau) || /unread|_new/i.test(icone)) { etat = 'nouveau'; }
		else if (memeImage(icone, ICONES.scelle) || /lock/i.test(icone)) { etat = 'scelle'; }
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
				if (ligneVide) { ligneVide.innerHTML = '<span class="dernier-vide">Aucun écrit pour l\u2019instant</span>'; }
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
		var surIndex = !$('.forum-tete-1740');
		chapitres.forEach(function (ch, i) {
			if (!surIndex) {
				// Page d'un forum : forme simple (Les Terres, sans gravure ni vignette)
				ch.setAttribute('data-gabarit', 'terres');
				ch.classList.add('chapitre-simple-1740');
				return;
			}
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
			zone.innerHTML = '<p class="derniers-vide">Rien n\u2019a encore été écrit.</p>';
			return;
		}
		zone.innerHTML = liste.map(function (e) {
			var avatar = e.avatar
				? '<img class="avatar-rond-1740" src="' + echapper(e.avatar) + '" alt="" loading="lazy">'
				: '<span class="avatar-rond-1740" aria-hidden="true"></span>';
			return '<div class="ecrit">' + avatar +
				'<div class="ecrit-infos"><a class="ecrit-titre" href="' + echapper(e.lien) + '" title="' + echapper(e.titreComplet) + '">' + echapper(e.titre) + '</a>' +
				'<span class="ecrit-meta">' + echapper(e.auteur) + ' · ' + echapper(e.date) + '</span></div>' +
				'<a class="ecrit-fleche" href="' + echapper(e.lien) + '" aria-label="Aller au dernier message">\u2192</a></div>';
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

	// Les liens de recherche (nouveaux messages, sans réponse\u2026) rejoignent le bas de l'accueil
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
	   Page d'un sujet
	   - surtitre du bloc de titre : nom du forum (dernier lien du fil d'Ariane)
	   - dates des messages : « Mar 20 Oct 2026 - 17:23 » devient
	     « Le 20 octobre 2026, à 17 h 23 »
	   ------------------------------------------------------------------ */
	var MOIS_1740 = { jan: 'janvier', 'fév': 'février', fev: 'février', mar: 'mars', avr: 'avril', mai: 'mai', juin: 'juin', juil: 'juillet', 'aoû': 'août', aou: 'août', sep: 'septembre', sept: 'septembre', oct: 'octobre', nov: 'novembre', 'déc': 'décembre', dec: 'décembre' };

	function heure1740(h, m) { return parseInt(h, 10) + ' h ' + m; }

	function dateLongue1740(texte) {
		var t = texte.replace(/\s+/g, ' ').trim();
		var r = t.match(/^(?:[A-Za-zÀ-ÿ]+\.?\s+)?(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\.?\s+(\d{4})\s*-\s*(\d{1,2}):(\d{2})$/);
		if (r) {
			var mois = MOIS_1740[r[2].toLowerCase()];
			if (mois) { return 'Le ' + parseInt(r[1], 10) + (r[1] === '1' || r[1] === '01' ? 'er' : '') + ' ' + mois + ' ' + r[3] + ', à ' + heure1740(r[4], r[5]); }
		}
		r = t.match(/^(Aujourd'hui|Hier)\s+à\s+(\d{1,2}):(\d{2})$/i);
		if (r) { return r[1].charAt(0).toUpperCase() + r[1].slice(1).toLowerCase() + ', à ' + heure1740(r[2], r[3]); }
		return null;
	}

	function initSujet() {
		var surtitre = $('.sujet-surtitre-1740');
		if (surtitre) {
			var liens = $$('.ariane-1740 a.nav');
			if (liens.length > 1) { surtitre.textContent = liens[liens.length - 1].textContent.trim(); }
		}
		// « Surveiller les réponses de ce sujet » / « Arrêter de surveiller ce sujet » : libellés courts
		$$('.surveiller-1740 a').forEach(function (a) {
			var t = a.textContent.trim().toLowerCase();
			if (!t) { return; }
			a.title = a.textContent.trim();
			a.textContent = /^arr/.test(t) ? 'Ne plus surveiller' : 'Surveiller';
		});
		$$('.post-1740 .topic-date').forEach(function (el) {
			// Seul le premier n\u0153ud texte contient la date (le reste : votes éventuels)
			var n = el.firstChild;
			while (n && !(n.nodeType === 3 && n.nodeValue.trim())) { n = n.nextSibling; }
			if (!n) { return; }
			var longue = dateLongue1740(n.nodeValue);
			if (longue) { n.nodeValue = longue; el.title = n.nodeValue; }
		});
	}


	/* ------------------------------------------------------------------
	   Éditeur (SCEditor) : la zone de texte en mode visuel est une petite
	   page à part (iframe) que le CSS du forum n'atteint pas. On lui donne
	   le fond, la police et les couleurs du thème.
	   ------------------------------------------------------------------ */
	function habillerEditeur(cadre) {
		var doc;
		try { doc = cadre.contentDocument; } catch (e) { return; }
		if (!doc || !doc.head || !doc.body || doc.getElementById('style-1740')) { return; }
		var css = getComputedStyle(document.documentElement);
		function v(nom, defaut) { return (css.getPropertyValue(nom) || '').trim() || defaut; }
		var police = doc.createElement('link');
		police.rel = 'stylesheet';
		police.href = 'https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,400;0,500;1,400&display=swap';
		doc.head.appendChild(police);
		var style = doc.createElement('style');
		style.id = 'style-1740';
		style.textContent =
			'html,body{background:' + v('--fond-nuit', '#0E0D0A') + ' !important;}' +
			'body{margin:0;padding:12px 14px;color:' + v('--texte', '#DDD6C6') + ';font-family:Alegreya,Georgia,serif;font-size:16px;line-height:1.6;}' +
			'a{color:' + v('--accent-lien', '#B3BA98') + ';}' +
			'blockquote,code,pre{background:rgba(255,255,255,0.04);border:1px solid ' + v('--ligne', '#3A352B') + ';}' +
			'::selection{background:rgba(' + v('--accent-rgb', '124,132,102') + ',0.45);}';
		doc.head.appendChild(style);
	}

	function initEditeur() {
		var essais = 0;
		var minuterie = setInterval(function () {
			essais++;
			var cadres = $$('.sceditor-container iframe');
			cadres.forEach(function (cadre) {
				habillerEditeur(cadre);
				if (!cadre.dataset.ecoute1740) {
					cadre.dataset.ecoute1740 = '1';
					// SCEditor recrée parfois le contenu (changement de mode) : on rhabille
					cadre.addEventListener('load', function () { habillerEditeur(cadre); });
				}
			});
			// Liste des smileys de la page « Poster » : elle aussi est une petite page à part
			$$('#smiley-box iframe').forEach(function (cadre) {
				if (!cadre.dataset.ecoute1740) {
					cadre.dataset.ecoute1740 = '1';
					// La liste des smileys se recharge (« Voir plus de smileys ») : on rhabille à chaque fois
					cadre.addEventListener('load', function () { var d = cadre.contentDocument; if (d) { var v = d.getElementById('style-1740'); if (v) { v.remove(); } } essais = 0; });
				}
				var doc;
				try { doc = cadre.contentDocument; } catch (e) { return; }
				if (!doc || !doc.head || doc.getElementById('style-1740')) { return; }
				var st = doc.createElement('style');
				st.id = 'style-1740';
				st.textContent = 'html,body,table,td,div{background:transparent !important;border-color:rgba(255,255,255,0.08) !important;}body{color:#A9A190;scrollbar-width:thin;scrollbar-color:#4A4536 transparent;}';
				doc.head.appendChild(st);
				cadre.style.background = 'transparent';
			});
			if (essais > 20 && !$('#smiley-box iframe')) { clearInterval(minuterie); }
		}, 500);
		// Retour au mode visuel après le mode source
		document.addEventListener('click', function (e) {
			if (e.target.closest && e.target.closest('.sceditor-button-source')) {
				setTimeout(function () { $$('.sceditor-container iframe').forEach(habillerEditeur); }, 100);
			}
		});
	}


	/* ------------------------------------------------------------------
	   Page d'un forum : liste des sujets
	   - surtitre : la catégorie (avant-dernier lien du fil d'Ariane)
	   - état de chaque sujet (nouveau, lu, verrouillé, annonce, note)
	   - les notes sont séparées des annonces dans un groupe « Épinglés »
	   ------------------------------------------------------------------ */
	function initListe() {
		var surtitre = $('.forum-tete-1740 .sujet-surtitre-1740');
		var liens = $$('.forum-page-1740 .ariane-1740 a.nav');
		if (surtitre && liens.length > 1) { surtitre.textContent = liens[liens.length - 2].textContent.trim(); }

		// « Utilisateurs parcourant actuellement ce forum : » \u2192 seulement les noms
		var parcourent = $('.parcourent-texte-1740');
		if (parcourent) {
			var premier = parcourent.firstChild;
			while (premier && !(premier.nodeType === 3 && premier.nodeValue.trim())) { premier = premier.nextSibling; }
			if (premier && /:\s*$/.test(premier.nodeValue)) { premier.nodeValue = ''; }
		}

		var I = window.FA_SUJETS_1740 || {};
		try { if (I.lu) { localStorage.setItem('sujets1740', JSON.stringify(I)); } } catch (e) {}
		function parmi(liste, src) { return (liste || []).some(function (x) { return memeImage(src, x); }); }
		function etatDe(li) {
			var src = li.getAttribute('data-icone') || '';
			var type = ($('.sujet-type-1740', li) || {}).textContent || '';
			if (/annonce/i.test(type) || parmi(I.annonce, src)) { return 'annonce'; }
			if (/note|post-it|épingl/i.test(type) || parmi(I.epingle, src)) { return 'epingle'; }
			if (parmi(I.scelle, src) || /lock/i.test(src)) { return 'scelle'; }
			if (parmi(I.nouveau, src) || /unread|_new/i.test(src)) { return 'nouveau'; }
			return 'lu';
		}
		$$('.sujet-1740').forEach(function (li) { li.classList.add('est-' + etatDe(li)); });

		// Groupes : on reconstruit Annonces, Épinglés et Sujets d'après le type de chaque sujet,
		// quel que soit le regroupement fait par Forumactif
		$$('.groupes-1740').forEach(function (conteneur) {
			var groupes = $$('.groupe-1740', conteneur);
			if (!groupes.length) { return; }
			var rangees = $$('.sujet-1740', conteneur);
			if (!rangees.length) { return; }
			var modele = groupes[0].cloneNode(true);
			$$('.sujet-1740, .sujet-vide-1740', modele).forEach(function (li) { li.remove(); });
			var ordre = [
				{ nom: 'Annonces', classe: 'est-annonce' },
				{ nom: 'Épinglés', classe: 'est-epingle' },
				{ nom: 'Sujets', classe: null }
			];
			var nouveaux = [];
			ordre.forEach(function (o) {
				var lot = rangees.filter(function (li) {
					var special = li.classList.contains('est-annonce') || li.classList.contains('est-epingle');
					return o.classe ? li.classList.contains(o.classe) : !special;
				});
				if (!lot.length) { return; }
				var g = modele.cloneNode(true);
				var nom = $('.groupe-nom-1740', g);
				if (nom) { nom.textContent = o.nom; }
				var liste = $('.groupe-liste-1740', g);
				lot.forEach(function (li) { liste.appendChild(li); });
				nouveaux.push(g);
			});
			groupes.forEach(function (g) { g.remove(); });
			nouveaux.forEach(function (g) { conteneur.appendChild(g); });
		});

		// Numéros de pages d'un sujet : seulement les liens, sans « Aller à la page »
		$$('.mini-pages-1740').forEach(function (z) {
			var liensPages = $$('a', z).filter(function (a) { return /\d/.test(a.textContent); });
			z.innerHTML = '';
			liensPages.forEach(function (a) { z.appendChild(a); });
		});
	}


	/* ------------------------------------------------------------------
	   Barre de progression (messages, pages) : construite à partir de
	   <span data-part="25" data-etat="fait">Nom</span>
	   ------------------------------------------------------------------ */
	function initProgression() {
		$$('.progression-1740').forEach(function (bloc) {
			if (bloc.classList.contains('prete-1740')) { return; }
			var etapes = $$('span[data-part]', bloc).map(function (s) {
				var etat = (s.getAttribute('data-etat') || 'avenir').trim().toLowerCase();
				return { nom: s.textContent.trim(), part: parseFloat(s.getAttribute('data-part')) || 0, etat: etat };
			});
			var total = etapes.reduce(function (t, e) { return t + (e.etat === 'fait' ? e.part : 0); }, 0);
			var titre = bloc.getAttribute('data-titre') || 'Avancement';
			var html = '<div class="p-tete"><span class="p-titre">' + echapper(titre) + '</span><span class="p-total">' + Math.round(total) + ' %</span></div>';
			html += '<div class="p-barre" aria-hidden="true">' + etapes.map(function (e) {
				return '<span class="p-seg ' + e.etat + '" style="--part:' + e.part + '" title="' + echapper(e.nom) + ' · ' + e.part + ' %"></span>';
			}).join('') + '</div>';
			html += '<div class="p-legende">' + etapes.map(function (e) {
				return '<span class="p-item ' + e.etat + '">' + echapper(e.nom) + ' <b>' + e.part + ' %</b></span>';
			}).join('') + '</div>';
			bloc.innerHTML = html; // retire aussi les <br> ajoutés par Forumactif
			bloc.setAttribute('role', 'group');
			bloc.setAttribute('aria-label', titre + ' : ' + Math.round(total) + ' %');
			bloc.classList.add('prete-1740');
		});
	}


	/* ------------------------------------------------------------------
	   Correspondance (messagerie) : dossiers, titres, état des lettres
	   ------------------------------------------------------------------ */
	var DOSSIERS_1740 = {
		inbox: { onglet: 'Reçues', titre: 'Lettres reçues' },
		sentbox: { onglet: 'Envoyées', titre: 'Lettres envoyées' },
		outbox: { onglet: 'En partance', titre: 'Lettres en partance' },
		savebox: { onglet: 'Conservées', titre: 'Lettres conservées' }
	};

	function initLettres() {
		var m = location.search.match(/[?&]folder=(\w+)/);
		var dossier = m && DOSSIERS_1740[m[1]] ? m[1] : 'inbox';

		// Onglets : libellés courts, dossier actif marqué
		$$('.onglet-l-1740').forEach(function (li) {
			var cle = li.getAttribute('data-dossier');
			var d = DOSSIERS_1740[cle];
			var lien = $('a', li);
			if (d) {
				if (lien) {
					Array.prototype.slice.call(lien.childNodes).forEach(function (n) { if (n.nodeType === 3) { n.remove(); } });
					lien.appendChild(document.createTextNode(d.onglet));
				}
				else {
					// Dossier courant affiché sans lien par Forumactif : on garde l'icône, on remplace le texte
					Array.prototype.slice.call(li.childNodes).forEach(function (n) { if (n.nodeType === 3 && n.nodeValue.trim()) { n.nodeValue = d.onglet; } });
				}
			}
			if (cle === dossier) { li.setAttribute('aria-current', 'page'); li.classList.add('actif'); }
			// Les icônes vont dans le lien pour être cliquables
			var ico = $(':scope > svg', li);
			if (ico && lien) { lien.insertBefore(ico, lien.firstChild); }
		});

		// Losange qui glisse sous le dossier actif
		placerMarqueOnglets();

		// Titre de la boîte
		var titre = $('.lettres-titre-1740');
		if (titre && !titre.textContent.trim().replace(/^Lettres$/, '')) { titre.textContent = DOSSIERS_1740[dossier].titre; }

		// « Votre boîte de réception est pleine à 2% » \u2192 « Coffret rempli à 2 % »
		$$('.coffret-1740').forEach(function (c) {
			if (c.classList.contains('dossier-1740')) { c.textContent = DOSSIERS_1740[dossier].titre; return; }
			var pct = c.textContent.match(/(\d+)\s*%/);
			if (pct) { c.textContent = 'Coffret rempli à ' + pct[1] + ' %'; }
		});

		// État de chaque lettre d'après l'icône de Forumactif
		$$('.lettre-1740').forEach(function (li) {
			var src = (li.getAttribute('data-icone') || '').toLowerCase();
			var etat = 'lue';
			if (/new|unread|non_?lu/.test(src) || $('strong', $('.lettre-infos-1740', li) || li)) { etat = 'non-lue'; }
			else if (/repl|answer|repondu|reponse/.test(src)) { etat = 'repondue'; }
			li.classList.add('est-' + etat);
		});

		// Dates en toutes lettres
		$$('.lettre-date-1740').forEach(function (el) {
			var longue = dateLongue1740(el.textContent);
			if (longue) { el.title = el.textContent.trim(); el.textContent = longue; }
		});

		// Lettre ouverte : « Correspondance de [expéditeur] », « A » \u2192 « à »
		var lue = $('.lettre-lue-1740');
		if (lue) {
			var exp = $('.lettre-expediteur-1740', lue);
			var sur = $('.lettres-surtitre-1740');
			if (exp && sur && exp.textContent.trim()) { sur.textContent = 'Correspondance de ' + exp.textContent.trim(); }
			var deA = $('.lettre-de-a-1740', lue);
			if (deA) {
				Array.prototype.slice.call(deA.childNodes).forEach(function (n) {
					if (n.nodeType === 3) { n.nodeValue = n.nodeValue.replace(/(^|\s)A(\s|$)/, '$1à$2'); }
				});
			}
		}
		// Correspondance précédente : on retire le grand titre de Forumactif
		$$('.historique-1740 h1, .historique-1740 h2, .historique-1740 .h3, .historique-1740 .page-title').forEach(function (h) {
			if (/historique/i.test(h.textContent)) { h.remove(); }
		});

		// Citer, Modifier, Profil : du texte à la place des petites images
		[['.lettre-citer-1740', 'Citer'], ['.lettre-modifier-1740', 'Modifier'], ['.lettre-profil-1740', 'Profil']].forEach(function (p) {
			$$(p[0]).forEach(function (zone) {
				var a = $('a', zone);
				if (!a) { zone.remove(); return; }
				a.textContent = p[1];
			});
		});
	}


	function placerMarqueOnglets() {
		var ul = $('.onglets-l-1740');
		var actif = $('.onglet-l-1740.actif');
		if (!ul || !actif) { return; }
		var marque = $('.onglets-marque-1740', ul);
		if (!marque) {
			marque = document.createElement('span');
			marque.className = 'onglets-marque-1740';
			marque.setAttribute('aria-hidden', 'true');
			ul.appendChild(marque);
		}
		marque.style.left = (actif.offsetLeft + actif.offsetWidth / 2) + 'px';
	}

	// Changer de dossier sans recharger la page (seulement depuis la boîte aux lettres)
	function initOngletsLettres() {
		// Le losange se recale une fois les polices chargées, et au redimensionnement
		window.addEventListener('load', placerMarqueOnglets);
		window.addEventListener('resize', placerMarqueOnglets);
		if (document.fonts && document.fonts.ready) { document.fonts.ready.then(placerMarqueOnglets); }
		if (!$('form[name="privmsg_list"]') || !window.fetch || !window.DOMParser) { return; }
		document.addEventListener('click', function (e) {
			var a = e.target.closest && e.target.closest('.onglet-l-1740 a');
			if (!a || e.ctrlKey || e.metaKey || e.shiftKey) { return; }
			e.preventDefault();
			chargerDossier(a.href, true);
		});
		window.addEventListener('popstate', function () { chargerDossier(location.href, false); });
	}

	function chargerDossier(url, memoriser) {
		var liste = $('.lettres-1740');
		if (!liste) { location.href = url; return; }
		// Le losange part tout de suite vers l'onglet cliqué
		var cle = (url.match(/[?&]folder=(\w+)/) || [])[1] || 'inbox';
		$$('.onglet-l-1740').forEach(function (li) {
			var oui = li.getAttribute('data-dossier') === cle;
			li.classList.toggle('actif', oui);
			if (oui) { li.setAttribute('aria-current', 'page'); } else { li.removeAttribute('aria-current'); }
		});
		placerMarqueOnglets();
		liste.classList.add('charge-1740');
		fetch(url, { credentials: 'same-origin' })
			.then(function (r) { return r.text(); })
			.then(function (html) {
				var doc = new DOMParser().parseFromString(html, 'text/html');
				var nouvelle = doc.querySelector('.lettres-1740');
				if (!nouvelle) { location.href = url; return; }
				liste.parentNode.replaceChild(document.importNode(nouvelle, true), liste);
				var coffret = doc.querySelector('.coffret-1740');
				var ici = $('.coffret-1740');
				if (ici) { ici.innerHTML = coffret ? coffret.innerHTML : ''; }
				var titre = $('.lettres-titre-1740');
				if (titre) { titre.textContent = 'Lettres'; }
				// Onglets : Forumactif écrit le dossier courant sans lien ; on reprend leur nouvelle version
				$$('.onglet-l-1740').forEach(function (li) {
					var neuf = doc.querySelector('.onglet-l-1740[data-dossier="' + li.getAttribute('data-dossier') + '"]');
					if (neuf) { li.innerHTML = neuf.innerHTML; }
				});
				if (memoriser) { history.pushState({}, '', url); }
				initLettres();
			})
			.catch(function () { location.href = url; });
	}

	// Page « Poster » utilisée pour une lettre : titres de la correspondance
	function titresEcriture() {
		// Historique d'une correspondance sous le formulaire : titre du thème
		$$('.revue-zone-1740 h1, .revue-zone-1740 h2, .revue-zone-1740 .h3, .revue-zone-1740 .page-title').forEach(function (h) {
			if (/historique/i.test(h.textContent)) { h.textContent = 'Correspondance précédente'; h.className = 'revue-titre-1740'; }
		});
		var h1 = $('.ecriture-tete-1740 h1.page-title');
		if (!h1) { return; }
		var t = h1.textContent.trim();
		if (/message priv/i.test(t)) {
			h1.textContent = /r[ée]pondre/i.test(t) ? 'Répondre à une lettre' : 'Écrire une lettre';
			var sur = $('.ecriture-surtitre-1740');
			if (sur) { sur.textContent = 'Correspondance'; }
		}
	}


	/* ------------------------------------------------------------------
	   Recensement (liste des membres)
	   - dates courtes : 07/11/26
	   - liens « Fiche » (champ site web) et « Lettre »
	   - Faceclaim lu dans le profil au premier survol, puis gardé en mémoire
	   ------------------------------------------------------------------ */
	var MOIS_NUM_1740 = { jan: 1, 'fév': 2, fev: 2, mar: 3, avr: 4, mai: 5, juin: 6, juil: 7, 'aoû': 8, aou: 8, sep: 9, sept: 9, oct: 10, nov: 11, 'déc': 12, dec: 12 };
	function deux(n) { return (n < 10 ? '0' : '') + n; }
	function dateCourte1740(texte) {
		var t = (texte || '').replace(/\s+/g, ' ').trim();
		var d = new Date();
		if (/^aujourd/i.test(t)) { return deux(d.getDate()) + '/' + deux(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2); }
		if (/^hier/i.test(t)) { d.setDate(d.getDate() - 1); return deux(d.getDate()) + '/' + deux(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2); }
		var r = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
		if (r) { return deux(+r[1]) + '/' + deux(+r[2]) + '/' + r[3].slice(-2); }
		r = t.match(/(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\.?\s+(\d{4})/);
		if (r && MOIS_NUM_1740[r[2].toLowerCase()]) { return deux(+r[1]) + '/' + deux(MOIS_NUM_1740[r[2].toLowerCase()]) + '/' + r[3].slice(2); }
		return t;
	}

	function lireFaceclaim(html) {
		var doc = new DOMParser().parseFromString(html, 'text/html');
		var etiquettes = doc.querySelectorAll('dt, label, span, div, th, b, strong');
		for (var i = 0; i < etiquettes.length; i++) {
			var el = etiquettes[i];
			if (el.children.length > 1) { continue; }
			if (!/^\s*faceclaim\s*:?\s*$/i.test(el.textContent)) { continue; }
			var dt = el.closest('dt, th, label') || el;
			var valeur = dt.nextElementSibling;
			if (!valeur && dt.parentElement) { valeur = dt.parentElement.nextElementSibling; }
			var champ = valeur && (valeur.querySelector('.field_uneditable') || valeur);
			var texte = champ ? champ.textContent.replace(/\s+/g, ' ').trim() : '';
			if (texte) { return texte; }
		}
		return '';
	}

	function initRecensement() {
		var memoire = {};
		try { memoire = JSON.parse(localStorage.getItem('faceclaims1740') || '{}'); } catch (e) {}
		var UNE_JOURNEE = 24 * 3600 * 1000;

		$$('.ame-1740').forEach(function (carte) {
			$$('.ame-date-1740', carte).forEach(function (dd) { dd.title = dd.textContent.trim(); dd.textContent = dateCourte1740(dd.textContent); });
			[['.ame-fiche-1740', 'Fiche'], ['.ame-lettre-1740', 'Lettre']].forEach(function (p) {
				var zone = $(p[0], carte);
				if (!zone) { return; }
				var a = $('a', zone);
				if (!a) { zone.innerHTML = ''; return; }
				a.textContent = p[1];
				zone.innerHTML = '';
				zone.appendChild(a);
			});

			var url = carte.getAttribute('data-profil');
			var fc = $('.ame-fc-1740', carte);
			if (!url || !fc) { return; }
			var connu = memoire[url];
			if (connu && Date.now() - connu.t < UNE_JOURNEE) { fc.textContent = connu.v || '\u2014'; return; }
			var charge = false;
			function charger() {
				if (charge || !window.fetch) { return; }
				charge = true;
				fetch(url, { credentials: 'same-origin' })
					.then(function (r) { return r.text(); })
					.then(function (html) {
						var v = lireFaceclaim(html);
						fc.textContent = v || '\u2014';
						memoire[url] = { v: v, t: Date.now() };
						try { localStorage.setItem('faceclaims1740', JSON.stringify(memoire)); } catch (e) {}
					})
					.catch(function () { fc.textContent = '\u2014'; charge = false; });
			}
			carte.addEventListener('mouseenter', charger);
			carte.addEventListener('focusin', charger);
		});
	}

	/* ------------------------------------------------------------------
	   Démarrage
	   ------------------------------------------------------------------ */
	/* ---------- Topic'it : retiré des formulaires (connexion, inscription) ---------- */
	function retirerTopicit() {
		var zone = $('#main-content') || document.body;
		var boutons = $$('[class*="topicit" i], [class*="topic-it" i], [id*="topicit" i], [id*="topic-it" i], a[href*="topicit" i], a[href*="topic-it" i], img[src*="topicit" i], iframe[src*="topicit" i]', zone)
			.concat($$('a, button, div, span', zone).filter(function (el) {
				return el.children.length <= 2 && /^\s*topic.?it\s*$/i.test(el.textContent);
			}));
		boutons.forEach(function (el) {
			var dl = el.closest('dl');
			if (dl && !dl.querySelector('input:not([type="hidden"]):not([class*="topicit" i])')) { dl.hidden = true; dl.style.display = 'none'; return; }
			/* Remonte jusqu'à la colonne entière (bouton + « Ou ») : on s'arrête
			   quand le parent contient aussi les champs de connexion */
			var bloc = el;
			while (bloc.parentElement && bloc.parentElement !== zone
				&& !bloc.parentElement.querySelector('input:not([type="hidden"]), textarea, select')) { bloc = bloc.parentElement; }
			bloc.style.display = 'none';
			/* La colonne de gauche reprend toute la largeur */
			var parent = bloc.parentElement;
			if (parent && parent !== zone) {
				var vus = Array.prototype.filter.call(parent.children, function (c) { return c !== bloc && getComputedStyle(c).display !== 'none'; });
				if (vus.length === 1) {
					parent.style.display = 'block';
					vus[0].style.width = 'auto';
					vus[0].style.maxWidth = 'none';
					vus[0].style.flex = '1 1 auto';
				}
			}
			[bloc.previousElementSibling, bloc.nextElementSibling].forEach(function (voisin) {
				if (voisin && /^\s*ou\s*$/i.test(voisin.textContent)) { voisin.style.display = 'none'; }
			});
		});
		$$('span, div, p, b, strong', zone).forEach(function (el) {
			if (!el.children.length && /^\s*ou\s*$/i.test(el.textContent) && el.closest('.panel, form')) { el.style.display = 'none'; }
		});
	}

	/* ---------- Pages du profil sans tête (notifications, sujets surveillés) ---------- */
	function enteteProfil() {
		var onglets = $('#main-content #tabs');
		if (!onglets || !$('a[href*="page_profil"]', onglets) || $('.page-tete-1740')) { return; }
		var tete = document.createElement('section');
		tete.className = 'cadre-orne sujet-cadre-1740 page-tete-1740 profil-tete-1740';
		tete.innerHTML = '<span class="sujet-surtitre-1740">Ton foyer</span>'
			+ '<h1 class="page-title">Mon profil</h1>'
			+ '<svg class="ornement-1740" viewBox="0 0 220 14" width="220" height="14" aria-hidden="true"><path class="filet" d="M0 7 H96 M124 7 H220"></path><path class="losange" d="M110 1 L116 7 L110 13 L104 7 Z"></path><circle class="point" cx="100" cy="7" r="1.4"></circle><circle class="point" cx="120" cy="7" r="1.4"></circle></svg>';
		onglets.parentNode.insertBefore(tete, onglets);
	}

	/* ---------- Sujets surveillés : icônes du thème et préfixes ---------- */
	var SVG_ETAT_1740 = '<svg class="etat-sujet-1740" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'
		+ '<g class="e-nouveau"><circle class="disque" cx="12" cy="12" r="9"></circle><g class="petales"><circle cx="21" cy="12" r="9"></circle><circle cx="3" cy="12" r="9"></circle></g><circle class="coeur" cx="12" cy="12" r="2"></circle></g>'
		+ '<g class="e-lu"><circle cx="12" cy="12" r="9"></circle></g>'
		+ '<g class="e-scelle"><circle class="cire" cx="12" cy="12" r="9"></circle><circle class="empreinte" cx="12" cy="12" r="5"></circle></g>'
		+ '<g class="e-annonce"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7z"></path></g>'
		+ '<g class="e-epingle"><circle cx="12" cy="8" r="4"></circle><path d="M12 12v9"></path></g></svg>';
	function initSurveilles() {
		var table = $('#cp-main table.table1');
		if (!table || !/watchsearch|favouritesearch/.test(location.search)) { return; }
		var I = {};
		try { I = JSON.parse(localStorage.getItem('sujets1740') || '{}'); } catch (e) {}
		function parmi(liste, src) { return (liste || []).some(function (x) { return x && memeImage(src, x); }); }
		function imageDe(td) {
			var img = $('img', td);
			if (img) { return img.getAttribute('src') || ''; }
			var el = [td].concat($$('*', td));
			for (var i = 0; i < el.length; i++) {
				var bg = getComputedStyle(el[i]).backgroundImage;
				if (bg && bg !== 'none') { return bg.replace(/^url\(["']?|["']?\)$/g, ''); }
			}
			return '';
		}
		$$('tbody tr', table).forEach(function (tr) {
			var cases = tr.children;
			if (cases.length < 3) { return; }
			var icone = cases[0], titre = cases[1];
			/* « Annonce: » / « Note: » devant le titre */
			var type = '';
			var gras = $('strong, b', titre);
			if (gras && /:\s*$/.test(gras.textContent) && !gras.closest('a')) {
				type = gras.textContent.replace(/:\s*$/, '').trim();
				gras.remove();
			}
			var src = imageDe(icone);
			var etat = 'lu';
			if (/annonce/i.test(type) || parmi(I.annonce, src)) { etat = 'annonce'; }
			else if (/note|post-it|épingl/i.test(type) || parmi(I.epingle, src)) { etat = 'epingle'; }
			else if (parmi(I.scelle, src) || /lock/i.test(src)) { etat = 'scelle'; }
			else if (parmi(I.nouveau, src) || /new|unread/i.test(src)) { etat = 'nouveau'; }
			tr.classList.add('est-' + etat);
			icone.classList.add('icone-surveille-1740');
			icone.innerHTML = SVG_ETAT_1740;
			if (etat === 'annonce' || etat === 'epingle') {
				var marque = document.createElement('span');
				marque.className = 'sujet-prefixe-1740';
				marque.textContent = etat === 'annonce' ? 'Annonce' : 'Épinglé';
				titre.insertBefore(marque, titre.firstChild);
			}
		});
	}

	/* ---------- Résultats de recherche (sujets) : même présentation que la liste des sujets ---------- */
	function initRecherche() {
		var listes = $$('#main-content ul.topiclist.topics.search');
		if (!listes.length) { return; }
		var I = {};
		try { I = JSON.parse(localStorage.getItem('sujets1740') || '{}'); } catch (e) {}
		function parmi(l, src) { return (l || []).some(function (x) { return x && memeImage(src, x); }); }
		listes.forEach(function (ul) {
			var bloc = ul.closest('.forabg') || ul.parentNode;
			var entete = $('ul.topiclist li.header', bloc);
			var col = function (sel, def) { var el = entete && $(sel, entete); return el ? el.textContent.trim() : def; };
			var cadre = document.createElement('div');
			cadre.className = 'liste-1740 recherche-1740';
			cadre.innerHTML = '<div class="groupes-1740"><div class="groupe-1740 boite-1740"><div class="groupe-tete-1740">'
				+ '<span></span><span class="groupe-nom-1740">' + echapper(col('dt', 'Sujets')) + '</span>'
				+ '<span class="groupe-col-1740">' + echapper(col('dd.posts', 'Réponses')) + '</span>'
				+ '<span class="groupe-col-1740">' + echapper(col('dd.views', 'Vues')) + '</span>'
				+ '<span class="groupe-col-1740 groupe-dernier-1740">Dernier écrit</span></div>'
				+ '<ul class="topiclist topics groupe-liste-1740"></ul></div></div>';
			var dest = $('.groupe-liste-1740', cadre);
			$$('li.row', ul).forEach(function (li) {
				var dl = $('dl', li);
				if (!dl) { return; }
				var src = (dl.getAttribute('style') || '').replace(/^.*url\(['"]?|['"]?\).*$/g, '');
				var gras = $('.topic-title-container > strong, .topic-title-container > b', dl);
				var type = gras ? gras.textContent.replace(/:\s*$/, '').trim() : '';
				var etat = 'lu';
				if (/annonce/i.test(type) || parmi(I.annonce, src) || /announce|global/i.test(src)) { etat = 'annonce'; }
				else if (/note|post-it|épingl/i.test(type) || parmi(I.epingle, src) || /sticky/i.test(src)) { etat = 'epingle'; }
				else if (parmi(I.scelle, src) || /lock/i.test(src)) { etat = 'scelle'; }
				else if (parmi(I.nouveau, src) || /unread|_new/i.test(src)) { etat = 'nouveau'; }
				var titre = $('a.topictitle', dl);
				var auteur = $('.topic-author', dl);
				var dernier = $('dd.lastpost', dl);
				var rang = document.createElement('li');
				rang.className = 'row sujet-1740 est-' + etat;
				rang.innerHTML = SVG_ETAT_1740 + '<div class="sujet-infos-1740"><h2 class="topic-title"></h2></div>'
					+ '<span class="sujet-nb-1740 posts"></span><span class="sujet-nb-1740 views"></span>'
					+ '<div class="sujet-dernier-1740 lastpost"><span class="sujet-dernier-infos-1740"><span class="dernier-auteur-1740"></span><span class="dernier-date-1740"></span></span><span class="dernier-lien-1740"></span></div>';
				var infos = $('.sujet-infos-1740', rang);
				if (etat === 'annonce' || etat === 'epingle') {
					var marque = document.createElement('span');
					marque.className = 'sujet-prefixe-1740';
					marque.textContent = etat === 'annonce' ? 'Annonce' : 'Épinglé';
					infos.insertBefore(marque, infos.firstChild);
				}
				if (titre) { titre.textContent = titre.textContent.trim(); $('h2', rang).appendChild(titre); }
				if (auteur) { infos.appendChild(auteur); }
				var p = $('dd.posts', dl), v = $('dd.views', dl);
				$('.posts', rang).textContent = p ? p.textContent.trim() : '';
				$('.views', rang).textContent = v ? v.textContent.trim() : '';
				if (dernier) {
					var nom = $('a[href^="/u"]', dernier);
					var lien = $('a[href*="#"]', dernier);
					var date = dernier.textContent.replace(/Derniers? Messages?/i, '');
					if (nom) { date = date.replace(nom.textContent, ''); $('.dernier-auteur-1740', rang).appendChild(nom); }
					$('.dernier-date-1740', rang).textContent = date.replace(/\s+/g, ' ').trim();
					if (lien) { $('.dernier-lien-1740', rang).appendChild(lien); }
				}
				dest.appendChild(rang);
			});
			bloc.parentNode.insertBefore(cadre, bloc);
			bloc.remove();
		});
	}

	/* ---------- Têtes de page pour les pages sans template (recherche, groupe\u2026) ---------- */
	var ORNEMENT_1740 = '<svg class="ornement-1740" viewBox="0 0 220 14" width="220" height="14" aria-hidden="true"><path class="filet" d="M0 7 H96 M124 7 H220"></path><path class="losange" d="M110 1 L116 7 L110 13 L104 7 Z"></path><circle class="point" cx="100" cy="7" r="1.4"></circle><circle class="point" cx="120" cy="7" r="1.4"></circle></svg>';
	function poserTete(avant, surtitre, titre) {
		var tete = document.createElement('section');
		tete.className = 'cadre-orne sujet-cadre-1740 page-tete-1740';
		tete.innerHTML = '<span class="sujet-surtitre-1740">' + echapper(surtitre) + '</span><h1 class="page-title">' + echapper(titre) + '</h1>' + ORNEMENT_1740;
		avant.parentNode.insertBefore(tete, avant);
		return tete;
	}
	function tetesSecondaires() {
		var zone = $('#main-content');
		if (!zone || $('.page-tete-1740', zone)) { return; }
		// Recherche : « 6 résultats trouvés pour \u2026 »
		var sous = /^\/search/.test(location.pathname) ? $('.sub-header', zone) : null;
		var h1 = sous && $('h1.page-title', sous);
		if (h1) {
			var texte = h1.textContent.trim();
			var nombre = (texte.match(/^(\d+)\s+r[ée]sultats?/i) || [])[1];
			var chemin = $('.sub-header-path', sous);
			var dernier = chemin ? chemin.textContent.split('::').pop().trim() : '';
			var titre = dernier && !/recherche avanc/i.test(dernier) ? dernier
				: (texte.split(/\spour\s*:?\s*/i)[1] || 'Recherche').replace(/^voir les\s+/i, '');
			titre = titre.charAt(0).toUpperCase() + titre.slice(1);
			var sur = nombre ? (nombre === '1' ? '1 résultat' : nombre + ' résultats') : 'Recherche';
			poserTete(sous, sur, titre);
			sous.remove();
			return;
		}
		// Recherche avancée, résultats par messages, modération : titre posé seul
		var seul = $$('h1.page-title', zone).filter(function (h) { return !h.closest('.panel, .page-tete-1740, .sujet-cadre-1740'); })[0];
		if (seul && /^\/(search|modcp|merge)/.test(location.pathname)) {
			var txt = seul.textContent.trim();
			var nb = (txt.match(/^(\d+)\s+r[ée]sultats?/i) || [])[1];
			if (nb) {
				var quoi = (txt.split(/\spour\s*:?\s*/i)[1] || '').trim();
				poserTete(seul, nb === '1' ? '1 résultat' : nb + ' résultats', quoi ? '« ' + quoi + ' »' : 'Recherche');
			} else if (/^\/search/.test(location.pathname)) {
				poserTete(seul, 'Fouiller les archives', 'Recherche');
			} else {
				poserTete(seul, 'Modération', txt);
			}
			seul.remove();
			return;
		}
		// Page d'un groupe
		if (/^\/g\d+/.test(location.pathname)) {
			var t = $(':scope > h1.page-title', zone);
			if (t) { poserTete(t, 'Groupe', t.textContent.trim()); t.remove(); }
		}
	}

	/* ---------- Lignes « La date/heure actuelle\u2026 » et « Dernière visite\u2026 » : retirées ---------- */
	function retirerDates() {
		$$('#main-content > p').forEach(function (p) {
			if (/^\s*(La date\/heure actuelle|Dernière visite)/i.test(p.textContent)) { p.remove(); }
		});
	}

	/* ---------- Sondage : résultats en barres du thème ---------- */
	function initSondage() {
		$$('#main-content fieldset.polls dl').forEach(function (dl) {
			var dd = $('dd', dl);
			if (!dd || $('input', dl)) { return; }
			var m = dd.textContent.match(/(\d+)\s*-\s*(\d+(?:[.,]\d+)?)\s*%/);
			if (!m) { return; }
			var pc = parseFloat(m[2].replace(',', '.'));
			dl.classList.add('sondage-ligne-1740');
			dd.className = 'sondage-res-1740';
			dd.innerHTML = '<span class="sondage-jauge-1740"><span style="width:' + pc + '%"></span></span>'
				+ '<span class="sondage-nb-1740">' + m[2] + ' %<small>' + m[1] + (m[1] === '1' ? ' vote' : ' votes') + '</small></span>';
		});
		// Lien « Clore ce sondage » : un mot plutôt qu'une corbeille
		$$('#main-content .panel:has(fieldset.polls) .right-box a').forEach(function (a) {
			var img = $('img', a);
			if (img && !a.dataset.mot) { a.dataset.mot = '1'; a.title = img.title || img.alt || ''; a.textContent = /clore|close/i.test(a.title + a.href) ? 'Clore' : (img.alt || ''); a.classList.add('sondage-clore-1740'); }
		});
	}

	/* ---------- « Dernière édition\u2026 » : retirée des messages ---------- */
	function nettoyerEditions() {
		$$('.edited-message').forEach(function (el) { el.remove(); });
	}

	/* ---------- Codes de messages : liste, champs, exergue, signature, titres\u2026 ---------- */
	var BLOCS_1740 = ['page', 'bandeau', 'surtitre', 'grand-titre', 'titre', 'texte', 'note', 'liste', 'exergue', 'cadre', 'colonnes', 'champs', 'filet', 'signature', 'centre', 'image', 'medaillons', 'rp-infos', 'registre', 'avis-deces', 'pleine-largeur', 'lettre', 'journal', 'avis', 'livre', 'remede', 'comptine', 'incantation', 't1', 't2', 't3', 'sous-titre', 'intertitre', 'date', 'sign', 'jour', 'entete', 'titre-avis', 'par', 'chap', 'chap-titre', 'folio', 'r-titre', 'r-sous', 'c-titre', 'demande', 'types-demandes'];
	function estBloc(n) {
		return n && n.nodeType === 1 && BLOCS_1740.some(function (c) { return n.classList.contains(c); });
	}
	function voisin(n, sens) {
		var v = n[sens];
		while (v && v.nodeType === 3 && !v.nodeValue.trim()) { v = v[sens]; }
		return v;
	}
	// Coupe le contenu d'un élément en lignes (séparées par <br>), en gardant le HTML de chaque ligne
	function lignes(el) {
		var res = [], cur = [];
		Array.prototype.slice.call(el.childNodes).forEach(function (n) {
			if (n.nodeName === 'BR') { res.push(cur); cur = []; }
			else if (n.nodeType === 3 && /\n/.test(n.nodeValue)) {
				var morceaux = n.nodeValue.split('\n');
				morceaux.forEach(function (m, i) {
					if (i > 0) { res.push(cur); cur = []; }
					if (m) { cur.push(document.createTextNode(m)); }
				});
			}
			else { cur.push(n); }
		});
		res.push(cur);
		return res.filter(function (l) {
			return l.some(function (n) { return n.nodeType !== 3 || n.nodeValue.trim(); });
		});
	}
	function emballer(nodes, tag, cls) {
		var e = document.createElement(tag);
		if (cls) { e.className = cls; }
		nodes.forEach(function (n) { e.appendChild(n); });
		return e;
	}
	function rognerBr(el) {
		var n;
		while ((n = el.firstChild) && (n.nodeName === 'BR' || (n.nodeType === 3 && !n.nodeValue.trim()))) { el.removeChild(n); }
		while ((n = el.lastChild) && (n.nodeName === 'BR' || (n.nodeType === 3 && !n.nodeValue.trim()))) { el.removeChild(n); }
	}
	/* ---------- Registre des âmes ----------
	   Source actuelle : les <div class="ame"> écrits dans le message, une ligne « Champ : valeur » par champ.
	   Plus tard : la même fonction recevra les lignes d'une feuille Google (mêmes noms de champs). */
	var BOUGIE_1740 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21h6"></path><path d="M10 21V11h4v10"></path><path d="M12 11V9"></path><path d="M12 7c-1-1-1-2 0-3s1-2 0-3"></path></svg>';
	function cleChamp(t) {
		return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
	}
	function lireChamps(el) {
		var res = { _ordre: [] };
		lignes(el).forEach(function (ln) {
			var premier = ln[0];
			var m = premier && premier.nodeType === 3 ? premier.nodeValue.match(/^\s*([^:]+?)\s*:\s*([\s\S]*)$/) : null;
			if (!m) { return; }
			premier.nodeValue = m[2];
			var frag = document.createDocumentFragment();
			ln.forEach(function (n) { frag.appendChild(n); });
			var cle = cleChamp(m[1]);
			res[cle] = frag;
			res._ordre.push([cle, m[1]]);
		});
		return res;
	}
	function lireAmesMessage(reg) {
		return $$(':scope > .ame', reg).map(lireChamps);
	}
	function texteDe(v) { return v ? (typeof v === 'string' ? v : v.textContent).trim() : ''; }
	function valeurNoeud(v) {
		if (!v) { return document.createTextNode(''); }
		return typeof v === 'string' ? document.createTextNode(v) : v.cloneNode(true);
	}
	function bucketUnion(t) {
		if (/veu[fv]/i.test(t)) { return 'Veuf·ve'; }
		if (/mari|[ée]poux|[ée]pouse|fianc/i.test(t)) { return /fianc/i.test(t) ? 'Fiancé·e' : 'Marié·e'; }
		if (/c[ée]libat/i.test(t) || !t) { return 'Célibataire'; }
		return 'Autre';
	}
	function sansPacte(t) { return !t || /^(aucun|aucune|non|-|\u2014|sans)\b/i.test(t); }
	function construireRegistre(reg, ames) {
		var donnees = ames.map(function (a) {
			var union = texteDe(a.union);
			return {
				a: a,
				genre: texteDe(a.genre) || 'Autre',
				union: bucketUnion(union),
				pacte: sansPacte(texteDe(a.pacte)) ? 'Sans pacte' : 'Avec pacte',
				demeure: texteDe(a.demeure),
				morte: !!texteDe(a.deces)
			};
		});
		function options(cle, premier) {
			var vus = [];
			donnees.forEach(function (d) { if (d[cle] && vus.indexOf(d[cle]) < 0) { vus.push(d[cle]); } });
			vus.sort(function (x, y) { return x.localeCompare(y, 'fr'); });
			return '<option value="">' + premier + '</option>' + vus.map(function (v) { return '<option>' + echapper(v) + '</option>'; }).join('');
		}
		var id = 'reg' + Math.random().toString(36).slice(2, 7);
		var barre = document.createElement('form');
		barre.className = 'filtres-1740';
		barre.setAttribute('onsubmit', 'return false');
		barre.innerHTML =
			'<div class="filtre-1740"><label for="' + id + 'g">Genre</label><select id="' + id + 'g" data-cle="genre">' + options('genre', 'Tous') + '</select></div>' +
			'<div class="filtre-1740"><label for="' + id + 'u">Union</label><select id="' + id + 'u" data-cle="union">' + options('union', 'Toutes') + '</select></div>' +
			'<div class="filtre-1740"><label for="' + id + 'p">Pacte</label><select id="' + id + 'p" data-cle="pacte"><option value="">Tous</option><option>Avec pacte</option><option>Sans pacte</option></select></div>' +
			'<div class="filtre-1740"><label for="' + id + 'd">Demeure</label><select id="' + id + 'd" data-cle="demeure">' + options('demeure', 'Toutes') + '</select></div>' +
			'<div class="filtre-1740"><label for="' + id + 'v">Âmes</label><select id="' + id + 'v" data-cle="vie"><option value="vivantes">Vivantes</option><option value="defuntes">Défuntes</option><option value="">Toutes</option></select></div>' +
			'<div class="filtre-1740"><label for="' + id + 'o">Faceclaim</label><select id="' + id + 'o" data-ordre="1"><option value="az">A à Z</option><option value="za">Z à A</option></select></div>' +
			'<span class="compte-1740" aria-live="polite"></span>';
		var grille = document.createElement('div');
		grille.className = 'ames-1740';
		donnees.forEach(function (d) {
			var a = d.a;
			var f = document.createElement('article');
			f.className = 'fiche-ame-1740' + (d.morte ? ' defunte' : '');
			var portrait = texteDe(a.portrait);
			f.innerHTML = '<span class="medaillon-1740"><span>' + (portrait ? '<img src="' + echapper(portrait) + '" alt="" loading="lazy" />' : '') + '</span></span><div class="infos-1740"></div>';
			var infos = $('.infos-1740', f);
			var nom = document.createElement('div'); nom.className = 'nom-1740'; nom.appendChild(valeurNoeud(a.nom)); infos.appendChild(nom);
			if (texteDe(a.faceclaim)) { var fc = document.createElement('div'); fc.className = 'fc-1740'; fc.appendChild(valeurNoeud(a.faceclaim)); infos.appendChild(fc); }
			var ch = document.createElement('div'); ch.className = 'ch-1740';
			[['naissance', 'Naissance'], ['occupation', 'Occupation'], ['demeure', 'Demeure'], ['union', 'Union'], ['enfants', 'Enfants']].forEach(function (c) {
				if (!texteDe(a[c[0]])) { return; }
				var l = document.createElement('span'); l.className = 'l-1740'; l.textContent = c[1];
				var v = document.createElement('span'); v.appendChild(valeurNoeud(a[c[0]]));
				ch.appendChild(l); ch.appendChild(v);
			});
			infos.appendChild(ch);
			var p = document.createElement('span');
			if (d.pacte === 'Sans pacte') { p.className = 'pacte-1740 sans'; p.textContent = 'Sans pacte'; }
			else { p.className = 'pacte-1740'; p.appendChild(document.createTextNode('Pacte · ')); p.appendChild(valeurNoeud(a.pacte)); }
			infos.appendChild(p);
			if (d.morte) { var mo = document.createElement('div'); mo.className = 'mort-1740'; mo.appendChild(document.createTextNode('Décès : ')); mo.appendChild(valeurNoeud(a.deces)); infos.appendChild(mo); }
			d.el = f;
			grille.appendChild(f);
		});
		var vide = document.createElement('div'); vide.className = 'vide-1740'; vide.textContent = 'Aucune âme ne répond à ces critères.';
		grille.appendChild(vide);
		donnees.forEach(function (d, i) { d.rang = i; d.nomTri = texteDe(d.a.nom); d.fcTri = texteDe(d.a.faceclaim); });
		function trier() {
			var o = $('select[data-ordre]', barre).value;
			var liste = donnees.slice().sort(function (x, y) {
				// Les âmes sans faceclaim restent à la fin, dans les deux sens
				if (!x.fcTri || !y.fcTri) { return (x.fcTri ? 0 : 1) - (y.fcTri ? 0 : 1) || x.rang - y.rang; }
				var c = x.fcTri.localeCompare(y.fcTri, 'fr', { sensitivity: 'base' });
				return o === 'za' ? -c : c;
			});
			liste.forEach(function (d) { grille.insertBefore(d.el, vide); });
		}
		function filtrer() {
			trier();
			var crit = {};
			$$('select[data-cle]', barre).forEach(function (s) { crit[s.dataset.cle] = s.value; });
			var n = 0;
			donnees.forEach(function (d) {
				var ok = (!crit.genre || d.genre === crit.genre) && (!crit.union || d.union === crit.union) &&
					(!crit.pacte || d.pacte === crit.pacte) && (!crit.demeure || d.demeure === crit.demeure) &&
					(!crit.vie || (crit.vie === 'defuntes' ? d.morte : !d.morte));
				d.el.hidden = !ok;
				if (ok) { n++; }
			});
			vide.hidden = n > 0;
			$('.compte-1740', barre).textContent = n + (n > 1 ? ' âmes' : ' âme');
		}
		barre.addEventListener('change', filtrer);
		reg.innerHTML = '';
		reg.appendChild(barre);
		reg.appendChild(grille);
		filtrer();
	}
	function initRegistre(zone) {
		$$('.registre', zone).forEach(function (reg) {
			if (reg.dataset.fait) { return; }
			reg.dataset.fait = '1';
			construireRegistre(reg, lireAmesMessage(reg));
		});
		$$('.avis-deces', zone).forEach(function (av) {
			if (av.dataset.fait) { return; }
			av.dataset.fait = '1';
			var t = av.textContent.split('|');
			var msg = t[0].trim(), quand = (t[1] || '').trim();
			av.innerHTML = '<span class="bougie-1740" role="img" aria-label="Avis de décès">' + BOUGIE_1740 + '</span><div><span class="qui-1740">Le Veilleur</span><p class="msg-1740"></p>' + (quand ? '<span class="quand-1740"></span>' : '') + '</div>';
			$('.msg-1740', av).textContent = msg;
			if (quand) { $('.quand-1740', av).textContent = quand; }
		});
		// Message en pleine largeur : sans la fiche du personnage
		if ($('.registre, .pleine-largeur', zone)) {
			var post = zone.closest('.post-1740');
			if (post) { post.classList.add('pleine-1740'); }
		}
	}

	/* ---------- Demandes : types (message du staff) et fiches de demande ---------- */
	var ICONES_DEMANDE_1740 = {
		deplacer: '<path d="M4 12h14M14 8l4 4-4 4"></path>',
		archiver: '<rect x="4" y="5" width="16" height="4"></rect><path d="M6 9v10h12V9M10 13h4"></path>',
		desarchiver: '<rect x="4" y="5" width="16" height="4"></rect><path d="M6 9v10h12V9M12 17v-5M10 14l2-2 2 2"></path>',
		supprimer: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"></path>',
		changer: '<path d="M4 20l1-4L16 5l3 3L8 19z"></path>',
		autre: '<circle cx="12" cy="12" r="8"></circle><path d="M12 16v.5M12 8a2.5 2.5 0 0 1 1 4.8V14"></path>'
	};
	function iconeDemande(t, taille) {
		var n = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
		var k = /desarchiv/.test(n) ? 'desarchiver' : /archiv/.test(n) ? 'archiver' : /deplac/.test(n) ? 'deplacer' :
			/suppr|effac/.test(n) ? 'supprimer' : /chang|modif|nom|avatar|groupe/.test(n) ? 'changer' : 'autre';
		return '<svg width="' + taille + '" height="' + taille + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONES_DEMANDE_1740[k] + '</svg>';
	}
	function initDemandes(zone) {
		$$('.types-demandes', zone).forEach(function (bloc) {
			if (bloc.dataset.fait) { return; }
			bloc.dataset.fait = '1';
			var ls = lignes(bloc);
			bloc.innerHTML = '';
			ls.forEach(function (ln) {
				var frag = document.createElement('span');
				ln.forEach(function (n) { frag.appendChild(n); });
				var parts = frag.innerHTML.split('|');
				var titre = parts[0].trim(), detail = (parts[1] || '').trim();
				var tmp = document.createElement('span'); tmp.innerHTML = titre;
				var d = document.createElement('div');
				d.className = 'type-demande-1740';
				d.innerHTML = iconeDemande(tmp.textContent, 18) + '<span><b>' + titre + '</b>' + (detail ? '<br>' + detail : '') + '</span>';
				bloc.appendChild(d);
			});
		});
		$$('.demande', zone).forEach(function (dem) {
			if (dem.dataset.fait) { return; }
			dem.dataset.fait = '1';
			var champs = lireChamps(dem);
			var type = texteDe(champs.demande) || 'Demande';
			var statut = texteDe(champs.statut);
			var tete = '<div class="demande-tete-1740"><span class="ic-1740">' + iconeDemande(type, 16) + '</span><span><span class="q-1740">Demande</span><span class="t-1740"></span></span></div>';
			var tampon = '';
			if (statut) {
				var etat = /trait|fait|accept|valid/i.test(statut) ? 'faite' : /refus/i.test(statut) ? 'refusee' : 'attente';
				var bouts = statut.split('|');
				tampon = '<span class="statut-1740 ' + etat + '"><span class="s-1740"></span>' + (bouts[1] ? '<small></small>' : '') + '</span>';
			} else {
				tampon = '<span class="statut-1740 attente"><span class="s-1740">En attente</span></span>';
			}
			var ch = document.createElement('div');
			ch.className = 'd-ch-1740';
			champs._ordre.forEach(function (o) {
				var cle = o[0], nom = o[1];
				if (cle === 'demande' || cle === 'statut' || !texteDe(champs[cle])) { return; }
				var l = document.createElement('span'); l.className = 'l-1740'; l.textContent = nom;
				var v = document.createElement('span'); v.appendChild(valeurNoeud(champs[cle]));
				ch.appendChild(l); ch.appendChild(v);
			});
			dem.innerHTML = tete + tampon + '<div class="demande-corps-1740"></div>';
			$('.t-1740', dem).textContent = type;
			if (statut) {
				var b = statut.split('|');
				$('.s-1740', dem).textContent = b[0].trim();
				if (b[1]) { $('.statut-1740 small', dem).textContent = b[1].trim(); }
			}
			$('.demande-corps-1740', dem).appendChild(ch);
		});
	}

	function initCodes() {
		$$('.postbody .content, #preview .content').forEach(function (zone) {
			if ($('.lettre .sign', zone)) { policeLettre(); }
			if (zone.dataset.codes1740) { return; }
			zone.dataset.codes1740 = '1';
			var blocs = $$('.' + BLOCS_1740.join(', .'), zone).filter(estBloc);
			if (!blocs.length) { return; }
			// Sauts de ligne collés aux blocs : retirés
			$$('br', zone).forEach(function (br) {
				if (estBloc(voisin(br, 'previousSibling')) || estBloc(voisin(br, 'nextSibling'))) { br.remove(); }
			});
			blocs.forEach(rognerBr);

			$$('.page', zone).forEach(function (p) {
				var c = document.createElement('span');
				c.className = 'coins-1740'; c.setAttribute('aria-hidden', 'true');
				p.insertBefore(c, p.firstChild);
			});
			$$('.titre', zone).forEach(function (t) {
				var m = (t.firstChild && t.firstChild.nodeType === 3) ? t.firstChild.nodeValue.match(/^\s*([IVXLC]+)\.\s+/) : null;
				if (!m) { return; }
				t.firstChild.nodeValue = t.firstChild.nodeValue.slice(m[0].length);
				var n = document.createElement('span');
				n.className = 'n-1740';
				n.innerHTML = '<span>' + m[1] + '</span>';
				t.insertBefore(n, t.firstChild);
			});
			$$('.liste', zone).forEach(function (l) {
				if ($('li', l)) { return; }
				var ls = lignes(l);
				l.innerHTML = '';
				ls.forEach(function (ln) { l.appendChild(emballer(ln, 'div', 'li-1740')); });
			});
			$$('.champs', zone).forEach(function (c) {
				var ls = lignes(c);
				c.innerHTML = '';
				ls.forEach(function (ln) {
					var premier = ln[0];
					var m = premier && premier.nodeType === 3 ? premier.nodeValue.match(/^\s*([^:]+?)\s*:\s+([\s\S]*)$/) : null;
					if (m) {
						premier.nodeValue = m[2];
						var lib = document.createElement('span');
						lib.className = 'l-1740';
						lib.textContent = m[1];
						c.appendChild(lib);
						c.appendChild(emballer(ln, 'span'));
					} else {
						var tout = emballer(ln, 'span');
						tout.style.gridColumn = '1 / -1';
						c.appendChild(tout);
					}
				});
			});
			// « texte | source » : la partie après la dernière barre devient la source ou le sceau
			function couperBarre(el) {
				var t = el.lastChild;
				while (t && t.nodeType !== 3) { t = t.previousSibling; }
				if (!t || t.nodeValue.indexOf('|') < 0) { return null; }
				var i = t.nodeValue.lastIndexOf('|');
				var apres = t.nodeValue.slice(i + 1).trim();
				t.nodeValue = t.nodeValue.slice(0, i).replace(/\s+$/, '');
				var reste = t.nextSibling, extra = [];
				while (reste) { var s2 = reste.nextSibling; extra.push(reste); reste = s2; }
				return { texte: apres, noeuds: extra };
			}
			$$('.exergue', zone).forEach(function (e) {
				var c = couperBarre(e);
				if (!c) { return; }
				var src = document.createElement('span');
				src.className = 'source-1740';
				src.textContent = c.texte;
				c.noeuds.forEach(function (n) { src.appendChild(n); });
				e.appendChild(src);
			});
			$$('.signature', zone).forEach(function (sg) {
				var c = couperBarre(sg);
				if (!c || !c.texte) { return; }
				var s3 = document.createElement('span');
				s3.className = 'sceau-1740'; s3.setAttribute('aria-hidden', 'true');
				s3.textContent = c.texte.charAt(0);
				sg.appendChild(s3);
			});
			// Bouton de musique : une icône seule, ouverte dans un nouvel onglet
			$$('a.musique', zone).forEach(function (a) {
				a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M9 18V5l11-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="17" cy="16" r="3"></circle></svg>';
				a.setAttribute('aria-label', 'Écouter la musique du RP');
				a.title = 'Écouter la musique du RP';
				a.target = '_blank';
				a.rel = 'noopener';
			});
			// Pied du RP : « Lieu | Période | Avec » en trois cases (les tags restent des liens)
			$$('.rp-infos', zone).forEach(function (r) {
				var cases = [[]];
				Array.prototype.slice.call(r.childNodes).forEach(function (n) {
					if (n.nodeName === 'BR') { return; }
					if (n.nodeType === 3 && n.nodeValue.indexOf('|') >= 0) {
						n.nodeValue.split('|').forEach(function (m, i) {
							if (i > 0) { cases.push([]); }
							if (m.trim()) { cases[cases.length - 1].push(document.createTextNode(m.trim())); }
						});
					} else { cases[cases.length - 1].push(n); }
				});
				var noms = ['Lieu', 'Période', 'Avec'];
				r.innerHTML = '';
				cases.forEach(function (c, i) {
					var d = document.createElement('div');
					d.className = 'case-1740';
					d.innerHTML = '<span class="l-1740">' + (noms[i] || '') + '</span>';
					c.forEach(function (n) { d.appendChild(n); });
					r.appendChild(d);
				});
				r.style.setProperty('--cases', cases.length);
			});
			$$('.filet', zone).forEach(function (f) {
				if (!$('.l-1740', f)) { f.innerHTML = '<span class="l-1740"></span>'; f.setAttribute('aria-hidden', 'true'); }
			});
			initRegistre(zone);
			initDemandes(zone);
			// Lettre : « Nom|I » donne la signature et la lettre du cachet
			$$('.lettre .sign', zone).forEach(function (sg) {
				var t = sg.textContent.split('|');
				if (t.length < 2) { return; }
				sg.textContent = t[0].trim();
				var l = (t[1] || '').trim().charAt(0);
				var lettre = sg.closest('.lettre');
				if (l && lettre && !$('.cachet-1740', lettre)) {
					var c = document.createElement('span');
					c.className = 'cachet-1740'; c.setAttribute('aria-hidden', 'true'); c.textContent = l;
					lettre.appendChild(c);
				}
			});
			// Flouté : étiquette d'avertissement, révélé au clic
			$$('.flou', zone).forEach(function (f) {
				if (f.dataset.fait) { return; }
				f.dataset.fait = '1';
				f.setAttribute('tabindex', '0');
				f.setAttribute('role', 'button');
				f.setAttribute('aria-label', 'Passage masqué' + (f.title ? ' (' + f.title + ')' : '') + ' : cliquer pour révéler');
				// Le sujet de l'avertissement reste dans l'infobulle, sans étiquette qui coupe la lecture
				if (f.title && !/^avertissement/i.test(f.title)) { f.title = 'Avertissement : ' + f.title; }
				function voir() { f.classList.add('vu-1740'); f.removeAttribute('role'); f.removeAttribute('tabindex'); f.removeAttribute('aria-label'); }
				f.addEventListener('click', voir);
				f.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); voir(); } });
			});
		});
	}

	/* Police calligraphiée des signatures de lettre : chargée seulement si besoin */
	function policeLettre() {
		if (document.getElementById('police-lettre-1740')) { return; }
		var l = document.createElement('link');
		l.id = 'police-lettre-1740';
		l.rel = 'stylesheet';
		l.href = 'https://fonts.googleapis.com/css2?family=Pinyon+Script&display=swap';
		document.head.appendChild(l);
	}

	/* ---------- Boîte « Balises » au-dessus de l'éditeur ---------- */
	var BALISES_1740 = [
		{ g: 'Titres', l: [
			['<span class="t1">Titre 1</span>', '<div class="t1">', '</div>'],
			['<span class="t2">Titre 2</span>', '<div class="t2">', '</div>'],
			['<span class="t3">Titre 3</span>', '<div class="t3">', '</div>'],
			['<span class="sous-titre">Sous-titre</span>', '<div class="sous-titre">', '</div>'],
			['<span class="intertitre">Intertitre</span>', '<div class="intertitre">', '</div>']
		] },
		{ g: 'Mise en forme', l: [
			['<span class="dialogue">« Paroles »</span>', '<span class="dialogue">', '</span>'],
			['<span class="gras">Gras</span>', '<span class="gras">', '</span>'],
			['<span class="murmure">Murmure</span>', '<span class="murmure">', '</span>'],
			['<span class="cri">Cri</span>', '<span class="cri">', '</span>'],
			['<span class="ancien">Ancien</span>', '<span class="ancien">', '</span>'],
			['<span class="marque">Surligné</span>', '<span class="marque">', '</span>'],
			['<span class="pc">Petites capitales</span>', '<span class="pc">', '</span>'],
			['<span class="espace">Espacé</span>', '<span class="espace">', '</span>'],
			['<span class="barre">Barré</span>', '<span class="barre">', '</span>'],
			['<span class="flou">Flouté</span>', '<span class="flou" title="sujet sensible">', '</span>']
		] },
		{ g: 'Couleurs', l: [
			['<span class="mousse">Mousse</span>', '<span class="mousse">', '</span>'],
			['<span class="ocre">Ocre</span>', '<span class="ocre">', '</span>'],
			['<span class="rouille">Rouille</span>', '<span class="rouille">', '</span>'],
			['<span class="sang">Sang</span>', '<span class="sang">', '</span>'],
			['<span class="cendre">Cendre</span>', '<span class="cendre">', '</span>'],
			['<span class="lune">Lune</span>', '<span class="lune">', '</span>']
		] },
		{ g: 'Gabarits de RP', l: [
			['Bannière gravée', '<div class="page">\n<div class="bandeau">\n<a class="musique" href="LIEN DE LA MUSIQUE"></a>\n<div class="surtitre">Une phrase d\'ambiance</div>\n<div class="grand-titre">Titre du RP</div>\n</div>\n<div class="texte lettrine">', '</div>\n<div class="rp-infos">Lieu|Saison, moment|@"Nom"</div>\n</div>', 'Le texte du RP\u2026'],
			['Bannière avec image', '<div class="page">\n<div class="bandeau">\n<img class="fond" src="ADRESSE DE L\'IMAGE" alt="" />\n<a class="musique" href="LIEN DE LA MUSIQUE"></a>\n<div class="surtitre">Une phrase d\'ambiance</div>\n<div class="grand-titre">Titre du RP</div>\n</div>\n<div class="texte lettrine">', '</div>\n<div class="rp-infos">Lieu|Saison, moment|@"Nom"</div>\n</div>', 'Le texte du RP\u2026'],
			['Avec médaillons', '<div class="page">\n<div class="bandeau">\n<img class="fond" src="ADRESSE DE L\'IMAGE" alt="" />\n<a class="musique" href="LIEN DE LA MUSIQUE"></a>\n<div class="surtitre">Une phrase d\'ambiance</div>\n<div class="grand-titre">Titre du RP</div>\n</div>\n<div class="medaillons"><img src="GIF 1" alt="" /><img src="GIF 2" alt="" /></div>\n<div class="texte lettrine">', '</div>\n<div class="rp-infos">Lieu|Saison, moment|@"Nom"</div>\n</div>', 'Le texte du RP\u2026']
		] }
	];
	function insererBalise(zoneTexte, avant, apres, defaut) {
		var inst = null;
		try { if (window.jQuery && jQuery(zoneTexte).sceditor) { inst = jQuery(zoneTexte).sceditor('instance'); } } catch (e) { inst = null; }
		if (inst && inst.insertText) {
			try { if (!inst.sourceMode()) { inst.sourceMode(true); } } catch (e2) {}
			var sel = '';
			try { var ta = $('.sceditor-container textarea', zoneTexte.parentNode) || zoneTexte; sel = ta.value.substring(ta.selectionStart, ta.selectionEnd); } catch (e3) {}
			if (!sel && defaut) { inst.insertText(avant + defaut + apres); }
			else { inst.insertText(avant, apres); }
			inst.focus();
			return;
		}
		// Zone de texte simple
		var d = zoneTexte.selectionStart, f = zoneTexte.selectionEnd, v = zoneTexte.value;
		var milieu = v.substring(d, f) || defaut || '';
		zoneTexte.value = v.substring(0, d) + avant + milieu + apres + v.substring(f);
		zoneTexte.focus();
		zoneTexte.selectionStart = d + avant.length;
		zoneTexte.selectionEnd = d + avant.length + milieu.length;
	}
	function initBalisesEditeur() {
		$$('textarea#text_editor_textarea, textarea[name="message"]').forEach(function (ta) {
			if (ta.dataset.balises1740) { return; }
			ta.dataset.balises1740 = '1';
			var bouton = document.createElement('button');
			bouton.type = 'button';
			bouton.className = 'balises-bouton-1740';
			bouton.setAttribute('aria-expanded', 'false');
			bouton.innerHTML = 'Balises <span class="fl" aria-hidden="true">\u25be</span>';
			var boite = document.createElement('div');
			boite.className = 'balises-1740';
			boite.setAttribute('aria-hidden', 'true');
			var html = '<div class="content">';
			BALISES_1740.forEach(function (grp, gi) {
				html += '<div class="groupe-b-1740">' + grp.g + '</div><div class="puces-1740">';
				grp.l.forEach(function (b, bi) {
					html += '<button type="button" class="puce-1740" data-g="' + gi + '" data-b="' + bi + '" title="Ajouter">' + (/^</.test(b[0]) ? b[0] : '<span>' + b[0] + '</span>') + '</button>';
				});
				html += '</div>';
			});
			html += '<p class="astuce-1740">Sélectionne du texte avant de cliquer pour l\'envelopper dans la balise. La boîte passe l\'éditeur en mode source, où les balises restent lisibles.</p></div>';
			boite.innerHTML = html;
			bouton.addEventListener('click', function () {
				var ouvert = boite.classList.toggle('ouvert-1740');
				boite.setAttribute('aria-hidden', String(!ouvert));
				bouton.setAttribute('aria-expanded', String(ouvert));
			});
			boite.addEventListener('click', function (e) {
				var p = e.target.closest('.puce-1740');
				if (!p || !p.dataset.g) { return; }
				var b = BALISES_1740[p.dataset.g].l[p.dataset.b];
				insererBalise(ta, b[1], b[2], b[3]);
			});
			// SCEditor place son cadre à côté de la zone de texte, parfois après nous : on se range juste avant lui
			function placer() {
				var cadre = $('.sceditor-container', ta.parentNode) || ta;
				if (boite.nextSibling !== cadre) {
					cadre.parentNode.insertBefore(bouton, cadre);
					cadre.parentNode.insertBefore(boite, cadre);
				}
				return cadre !== ta;
			}
			placer();
			var pop = creerPopCouleurs(ta);
			var popE = creerPopEmojis(ta);
			var essais = 0;
			var veille = setInterval(function () {
				var ok = placer();
				var barreOutils = ok && $('.sceditor-toolbar', ta.parentNode);
				if (barreOutils && !$('.groupe-1740', barreOutils)) { brancherBarre(barreOutils, bouton, boite, pop, popE); }
				if ((barreOutils && $('.groupe-1740', barreOutils)) || ++essais > 30) { clearInterval(veille); }
			}, 300);
			initOutilsEcriture(ta);
		});
	}

	/* ---------- Emojis : une sélection dans l'esprit du forum, et les récents ---------- */
	/* Smileys du forum : [nom, adresse, code] ; on insère le code, Forumactif affiche l'image */
	var SMILEYS_1740 = [
		["eyes", "https://2img.net/u/4411/70/16/94/smiles/3177531898.png", ":eyes:"],
		["blurryeyes", "https://2img.net/u/4411/70/16/94/smiles/1669923774.png", ":blurryeyes:"],
		["What a Face", "https://illipro.net/fa/i/smiles/fresse.png", ":face:"],
		["ui", "https://2img.net/u/4411/70/16/94/smiles/472940891.gif", ":ui:"],
		["Arrow", "https://illipro.net/fa/i/smiles/icon_arrow.gif", ":arrow:"],
		["Wink", "https://illipro.net/fa/i/smiles/icon_wink.gif", ";)"],
		["Razz", "https://illipro.net/fa/i/smiles/icon_razz.gif", ":P"],
		["Evil no", "https://2img.net/u/4411/70/16/94/smiles/101609121.gif", ":evilno:"],
		["Evil yes", "https://2img.net/u/4411/70/16/94/smiles/3541097573.gif", ":evilyes:"],
		["Stache", "https://2img.net/u/4411/70/16/94/smiles/579782056.png", ":stache:"],
		["hihi", "https://2img.net/u/4411/70/16/94/smiles/1606421958.png", ":hihi:"],
		["hmm", "https://2img.net/u/4411/70/16/94/smiles/109027622.gif", ":hmm:"],
		["hey", "https://2img.net/u/4411/70/16/94/smiles/3224543446.png", ":hey:"],
		["h\u00e9h\u00e9", "https://2img.net/u/4411/70/16/94/smiles/1672544379.gif", ":h\u00e9h\u00e9:"],
		["han", "https://2img.net/u/4411/70/16/94/smiles/1773549207.png", ":han:"],
		["fucku", "https://2img.net/u/4411/70/16/94/smiles/1111257090.png", ":fucku:"],
		["facepalm", "https://2img.net/u/4411/70/16/94/smiles/435245650.gif", ":facepalm:"],
		["cute", "https://2img.net/u/4411/70/16/94/smiles/2746488712.png", ":cute:"],
		["creepywink", "https://2img.net/u/4411/70/16/94/smiles/1771040369.gif", ":creepywink:"],
		["creepystab", "https://2img.net/u/4411/70/16/94/smiles/1482810269.gif", ":creepystab:"],
		["creepysmile", "https://2img.net/u/4411/70/16/94/smiles/1213754654.gif", ":creepysmile:"],
		["creepysad", "https://2img.net/u/4411/70/16/94/smiles/835645899.gif", ":creepysad:"],
		["creepydance", "https://2img.net/u/4411/70/16/94/smiles/1187508652.gif", ":creepydance:"],
		["creepylove", "https://2img.net/u/4411/70/16/94/smiles/3701335347.gif", ":creepylove:"],
		["choc", "https://2img.net/u/4411/70/16/94/smiles/3639322292.png", ":choc:"],
		["arg", "https://2img.net/u/4411/70/16/94/smiles/2836171925.png", ":arg:"],
		["afraid", "https://2img.net/u/4411/70/16/94/smiles/1023436970.gif", ":afraid:"],
		["you", "https://2img.net/u/4411/70/16/94/smiles/1594087956.gif", ":you:"],
		["yay", "https://2img.net/u/4411/70/16/94/smiles/113283969.gif", ":yay:"],
		["x333", "https://2img.net/u/4411/70/16/94/smiles/3545334754.gif", ":x333:"],
		["wink", "https://2img.net/u/4411/70/16/94/smiles/3665946034.gif", ":wink:"],
		["tss", "https://2img.net/u/4411/70/16/94/smiles/3337958985.png", ":tss:"],
		["siffle", "https://2img.net/u/4411/70/16/94/smiles/1589440575.gif", ":siffle:"],
		["shame", "https://2img.net/u/4411/70/16/94/smiles/307124865.gif", ":shame:"],
		["puppy", "https://2img.net/u/4411/70/16/94/smiles/2933412864.gif", ":puppy:"],
		["please", "https://2img.net/u/4411/70/16/94/smiles/3096898339.gif", ":please:"],
		["pff", "https://2img.net/u/4411/70/16/94/smiles/4267168643.gif", ":pff:"],
		["pervwink", "https://2img.net/u/4411/70/16/94/smiles/182591853.gif", ":pervwink:"],
		["nyah", "https://2img.net/u/4411/70/16/94/smiles/2373193043.png", ":nyah:"],
		["nice", "https://2img.net/u/4411/70/16/94/smiles/1893595548.gif", ":nice:"],
		["money", "https://2img.net/u/4411/70/16/94/smiles/966275855.gif", ":money:"],
		["lelele", "https://2img.net/u/4411/70/16/94/smiles/3870711600.gif", ":lelele:"],
		["huhu", "https://2img.net/u/4411/70/16/94/smiles/3086923383.gif", ":huhu:"],
		["angel", "https://2img.net/u/4411/70/16/94/smiles/1522770332.gif", ":angel:"],
		["what", "https://2img.net/u/4411/70/16/94/smiles/788399122.gif", ":what:"],
		["verysad", "https://2img.net/u/4411/70/16/94/smiles/3176443628.gif", ":verysad:"],
		["sleepy", "https://2img.net/u/4411/70/16/94/smiles/3288198322.gif", ":sleepy:"],
		["metal", "https://2img.net/u/4411/70/16/94/smiles/77360084.gif", ":metal:"],
		["music", "https://2img.net/u/4411/70/16/94/smiles/3267476803.gif", ":music:"],
		["cool", "https://2img.net/u/4411/70/16/94/smiles/374393840.gif", ":cool:"],
		["loser", "https://2img.net/u/4411/70/16/94/smiles/4024245373.gif", ":loser:"],
		["disco", "https://2img.net/u/4411/70/16/94/smiles/379753510.gif", ":disco:"],
		["worship", "https://2img.net/u/4411/70/16/94/smiles/1717139129.gif", ":worship:"],
		["raspberry", "https://2img.net/u/4411/70/16/94/smiles/3673877944.gif", ":raspberry:"],
		["smirk", "https://2img.net/u/4411/70/16/94/smiles/353984758.gif", ":smirk:"],
		["panic", "https://2img.net/u/4411/70/16/94/smiles/4090842561.gif", ":panic:"],
		["hide", "https://2img.net/u/4411/70/16/94/smiles/471959999.gif", ":hide1:"],
		["excited", "https://2img.net/u/4411/70/16/94/smiles/3731146444.gif", ":excite:"],
		["redheard", "https://2img.net/u/4411/70/16/94/smiles/735891920.gif", ":redheard:"],
		["dragon", "https://2img.net/u/4411/70/16/94/smiles/1229912207.gif", ":dragon:"],
		["satan", "https://2img.net/u/4411/70/16/94/smiles/2467308943.gif", ":satan:"],
		["fire", "https://2img.net/u/4411/70/16/94/smiles/4126048345.gif", ":fire:"],
		["cutie", "https://2img.net/u/4411/70/16/94/smiles/892961070.gif", ":cutie:"],
		["miniheart", "https://2img.net/u/4411/70/16/94/smiles/1670475621.gif", ":miniheart:"],
		["heart", "https://2img.net/u/4411/70/16/94/smiles/2242882698.gif", ":heartbig:"],
		["Insane", "https://2img.net/u/4411/70/16/94/smiles/2847602782.gif", ":insane:"],
		["diable", "https://2img.net/u/4411/70/16/94/smiles/1307187935.gif", ":diable:"],
		["plan", "https://2img.net/u/4411/70/16/94/smiles/237941722.gif", ":plan:"],
		["sus", "https://2img.net/u/4411/70/16/94/smiles/4113063528.gif", ":sus:1:"],
		["slip", "https://2img.net/u/4411/70/16/94/smiles/1594623657.gif", ":slip:"],
		["sex", "https://2img.net/u/4411/70/16/94/smiles/2321631482.gif", ":sex:"],
		["dramaqueen", "https://2img.net/u/4411/70/16/94/smiles/1821216215.gif", ":dramaqueen:"],
		["mdr", "https://2img.net/u/4411/70/16/94/smiles/2564959990.gif", ":mdr:"],
		["love", "https://2img.net/u/4411/70/16/94/smiles/365299704.gif", ":love:"],
		["angel1", "https://2img.net/u/4411/70/16/94/smiles/3934686736.gif", ":angel1:"],
		["unicorn", "https://2img.net/u/4411/70/16/94/smiles/3909132326.gif", ":unicorn:"],
		["youhou", "https://2img.net/u/4411/70/16/94/smiles/2360744695.gif", ":youhou:"],
		["blblbl", "https://2img.net/u/4411/70/16/94/smiles/3380145817.gif", ":blblbl:"],
		["uwu", "https://2img.net/u/4411/70/16/94/smiles/4149460435.gif", ":uwu:"],
		["TT", "https://2img.net/u/4411/70/16/94/smiles/2018561126.gif", ":TT:"],
		["wat", "https://2img.net/u/4411/70/16/94/smiles/604610314.png", ":wat:"],
		["dance", "https://2img.net/u/4411/70/16/94/smiles/1307222032.gif", ":dance:"],
		["yaaah", "https://2img.net/u/4411/70/16/94/smiles/3252099090.gif", ":yaaah:"],
		["sad", "https://2img.net/u/4411/70/16/94/smiles/2575908693.gif", ":sad:"],
		["love2", "https://2img.net/u/4411/70/16/94/smiles/806201620.gif", ":love2:"],
		["socute", "https://2img.net/u/4411/70/16/94/smiles/1779504010.gif", ":socute:"],
		["hello", "https://2img.net/u/4411/70/16/94/smiles/2895841602.gif", ":hello:"],
		["love1", "https://2img.net/u/4411/70/16/94/smiles/3907890591.gif", ":love1:"],
		["pervsus", "https://2img.net/u/4411/70/16/94/smiles/1456035731.gif", ":pervsus:"],
		["by", "https://2img.net/u/4411/70/16/94/smiles/3413948057.gif", ":by:"],
		["flying", "https://2img.net/u/4411/70/16/94/smiles/1387063021.gif", ":flying:"],
		["fear", "https://2img.net/u/4411/70/16/94/smiles/4172073153.gif", ":fear:"],
		["hero", "https://2img.net/u/4411/70/16/94/smiles/4044971028.gif", ":hero:"],
		["violetheart", "https://2img.net/u/4411/70/16/94/smiles/3344370891.gif", ":violetheart:"],
		["tears", "https://2img.net/u/4411/70/16/94/smiles/3965424677.gif", ":tears:"],
		["pc", "https://2img.net/u/4411/70/16/94/smiles/1271636532.gif", ":pc:"],
		["rain", "https://2img.net/u/4411/70/16/94/smiles/1500469732.gif", ":rain:"],
		["sleep", "https://2img.net/u/4411/70/16/94/smiles/16747610.gif", ":sleep:"],
		["tusors", "https://2img.net/u/4411/70/16/94/smiles/705701069.gif", ":tusors:"],
		["demon", "https://2img.net/u/4411/70/16/94/smiles/852620267.gif", ":demon:"],
		["king", "https://2img.net/u/4411/70/16/94/smiles/2983132238.gif", ":king:"],
		["sigh", "https://2img.net/u/4411/70/16/94/smiles/1443127739.gif", ":sigh:"],
		["writing", "https://2img.net/u/4411/70/16/94/smiles/2536381519.gif", ":writing:"],
		["string", "https://2img.net/u/4411/70/16/94/smiles/1580702974.gif", ":string:"],
		["rp", "https://2img.net/u/4411/70/16/94/smiles/3943383477.gif", ":rp:"],
		["dead", "https://2img.net/u/4411/70/16/94/smiles/513723008.gif", ":dead:"],
		["pliz", "https://2img.net/u/4411/70/16/94/smiles/4048962377.gif", ":pliz:"],
		["pickme", "https://2img.net/u/4411/70/16/94/smiles/2563367716.gif", ":pickme:"],
		["licking", "https://2img.net/u/4411/70/16/94/smiles/2963326436.gif", ":licking:"],
		["cloud", "https://2img.net/u/4411/70/16/94/smiles/402372924.gif", ":cloud:"],
		["bave", "https://2img.net/u/4411/70/16/94/smiles/2725436977.gif", ":bave:"],
		["ahah", "https://2img.net/u/4411/70/16/94/smiles/3626271242.gif", ":ahah:"],
		["flag", "https://2img.net/u/4411/70/16/94/smiles/2545399066.gif", ":flag:"],
		["table", "https://2img.net/u/4411/70/16/94/smiles/297912328.gif", ":table:"],
		["sus1", "https://2img.net/u/4411/70/16/94/smiles/696897483.gif", ":sus1:"],
		["dance", "https://2img.net/u/4411/70/16/94/smiles/1152727765.gif", ":dance:1:"],
		["shy", "https://2img.net/u/4411/70/16/94/smiles/2902606048.gif", ":shy:"],
		["tears1", "https://2img.net/u/4411/70/16/94/smiles/2312435022.gif", ":tears1:"],
		["toilette", "https://2img.net/u/4411/70/16/94/smiles/2371455484.gif", ":toilette:"],
		["drama", "https://2img.net/u/4411/70/16/94/smiles/3009465301.png", ":drama:"],
		["smile", "https://2img.net/u/4411/70/16/94/smiles/1556294999.gif", ":smile:"],
		["run", "https://2img.net/u/4411/70/16/94/smiles/2804140581.gif", ":run:"],
		["huhu", "https://2img.net/u/4411/70/16/94/smiles/476450803.gif", ":huhu:1:"],
		["cookie", "https://2img.net/u/4411/70/16/94/smiles/3101514467.gif", ":cookie:"],
		["smile1", "https://2img.net/u/4411/70/16/94/smiles/1234572778.gif", ":smile1:"],
		["yiii", "https://2img.net/u/4411/70/16/94/smiles/3427605693.gif", ":yiii:"],
		["niark", "https://2img.net/u/4411/70/16/94/smiles/946705534.gif", ":niark:"],
		["study", "https://2img.net/u/4411/70/16/94/smiles/791154980.gif", ":study:"],
		["verydead", "https://2img.net/u/4411/70/16/94/smiles/3893200826.gif", ":verydead:"],
		["popcorn", "https://2img.net/u/4411/70/16/94/smiles/3993433016.gif", ":popcorn:"],
		["laugh", "https://2img.net/u/4411/70/16/94/smiles/3324873198.gif", ":laugh:1:"],
		["ass", "https://2img.net/u/4411/70/16/94/smiles/2962307673.gif", ":ass:"],
		["horreur", "https://2img.net/u/4411/70/16/94/smiles/1281249081.gif", ":horreur:"],
		["hello", "https://2img.net/u/4411/70/16/94/smiles/3229670341.gif", ":hello:1:"],
		["yeah", "https://2img.net/u/4411/70/16/94/smiles/1536957899.gif", ":yeah:"],
		["scream", "https://2img.net/u/4411/70/16/94/smiles/2009859456.gif", ":scream:"],
		["poke", "https://2img.net/u/4411/70/16/94/smiles/2489612045.gif", ":poke:"],
		["hugbis", "https://2img.net/u/4411/70/16/94/smiles/2268658667.gif", ":hugbis:"],
		["ghost", "https://2img.net/u/4411/70/16/94/smiles/413549273.gif", ":ghost:"],
		["chasinglove", "https://2img.net/u/4411/70/16/94/smiles/3269343412.gif", ":chasinglove:"],
		["killing", "https://2img.net/u/4411/70/16/94/smiles/3742574854.gif", ":killing:"],
		["kiss", "https://2img.net/u/4411/70/16/94/smiles/2721564914.gif", ":kiss:"],
		["conforthug", "https://2img.net/u/4411/70/16/94/smiles/3146562807.gif", ":conforthug:"],
		["crushinghug", "https://2img.net/u/4411/70/16/94/smiles/1476841936.gif", ":crushinghug:"],
		["hug", "https://2img.net/u/4411/70/16/94/smiles/1211701061.gif", ":hug:1:"],
		["whip", "https://2img.net/u/4411/70/16/94/smiles/1394936947.gif", ":whip:"],
		["bros", "https://2img.net/u/4411/70/16/94/smiles/1210306412.gif", ":bros:"],
		["patpat", "https://2img.net/u/4411/70/16/94/smiles/294372041.gif", ":patpat:"],
		["chew", "https://2img.net/u/4411/70/16/94/smiles/4080590044.gif", ":chew:"],
		["num", "https://2img.net/u/4411/70/16/94/smiles/2686676025.gif", ":num:"],
		["nyan", "https://2img.net/u/4411/70/16/94/smiles/3614000442.gif", ":nyan:"],
		["grouphug", "https://2img.net/u/4411/70/16/94/smiles/587395375.gif", ":grouphug:"],
		["cat", "https://2img.net/u/4411/70/16/94/smiles/1579622392.png", ":cat:"],
		["bitch", "https://2img.net/u/4411/70/16/94/smiles/3442718624.png", ":bitch:"],
		["rip", "https://2img.net/u/4411/70/16/94/smiles/1662637656.gif", ":rip:"]
	];
	function lireEmojisRecents() {
		try { return JSON.parse(localStorage.getItem('emojis1740') || '[]'); } catch (e) { return []; }
	}
	function insererEmoji(ta, em) {
		var inst = instanceEditeur(ta);
		var texte = em;
		if (em.indexOf('img:') === 0) {
			var url = em.slice(4);
			var sm = SMILEYS_1740.filter(function (x) { return x[1] === url; })[0];
			texte = sm ? ' ' + sm[2] + ' ' : '[img]' + url + '[/img]';
		}
		try {
			if (inst && inst.insert) { inst.insert(texte); inst.focus(); }
			else {
				var d = ta.selectionStart, f = ta.selectionEnd;
				ta.value = ta.value.substring(0, d) + texte + ta.value.substring(f);
				ta.focus(); ta.selectionStart = ta.selectionEnd = d + texte.length;
			}
		} catch (e) {}
		var l = lireEmojisRecents().filter(function (x) { return x !== em; });
		l.unshift(em);
		try { localStorage.setItem('emojis1740', JSON.stringify(l.slice(0, 24))); } catch (e) {}
	}
	function boutonEmoji(e, nom) {
		if (e.indexOf('img:') === 0) {
			return '<button type="button" class="emoji-1740 smiley-1740" data-e="' + echapper(e) + '" title="' + echapper(nom || '') + '"><img src="' + echapper(e.slice(4)) + '" alt="' + echapper(nom || '') + '" loading="lazy"></button>';
		}
		return '<button type="button" class="emoji-1740" data-e="' + e + '">' + e + '</button>';
	}
	function remplirEmojis(pop) {
		var rec = lireEmojisRecents().filter(function (e) { return e.indexOf('img:') === 0; });
		var html = '';
		if (rec.length) {
			html += '<div class="emojis-titre-1740">Récents</div><div class="emojis-grille-1740">'
				+ rec.map(function (e) { return boutonEmoji(e); }).join('') + '</div>';
		}
		html += '<div class="emojis-titre-1740">Smileys</div><div class="emojis-grille-1740">'
			+ SMILEYS_1740.map(function (sm) { return boutonEmoji('img:' + sm[1], sm[0]); }).join('') + '</div>';
		pop.innerHTML = html;
	}
	/* Les fenêtres de la barre d'outils emportent leur style de base : elles restent en place même si le CSS du thème tarde */
	function styleFenetres1740() {
		if (document.getElementById('fenetres-1740')) { return; }
		var st = document.createElement('style');
		st.id = 'fenetres-1740';
		st.textContent =
			'.emojis-pop-1740,.couleurs-pop-1740{position:fixed;z-index:9999;box-sizing:border-box;padding:10px 12px 12px;border:1px solid #4A4536;background:#1F1C16;box-shadow:0 8px 24px rgba(0,0,0,.55);color:#DDD6C6;font-family:Alegreya,Georgia,serif;text-align:left}' +
			'.emojis-pop-1740[hidden],.couleurs-pop-1740[hidden]{display:none}' +
			'.emojis-pop-1740{width:340px;max-height:340px;overflow-y:auto}' +
			'.emojis-pop-1740 .emojis-grille-1740{display:grid;grid-template-columns:repeat(8,1fr);gap:2px}' +
			'.emojis-pop-1740 .emoji-1740{display:flex;align-items:center;justify-content:center;height:36px;padding:0;border:1px solid transparent;background:none;cursor:pointer}' +
			'.emojis-pop-1740 .emoji-1740 img{display:block;max-width:30px;max-height:30px}' +
			'.emojis-pop-1740 .emojis-titre-1740{margin:8px 0 4px;font-size:13px;letter-spacing:.12em;color:#7C8466;font-variant:small-caps}' +
			'.couleurs-pop-1740{width:270px}';
		document.head.appendChild(st);
	}

	/* Place une fenêtre juste sous son bouton (position fixe, suit le défilement) */
	function placerSous(pop, bouton, largeur) {
		function maj() {
			var r = bouton.getBoundingClientRect();
			pop.style.position = 'fixed';
			pop.style.left = Math.max(8, Math.min(r.left, document.documentElement.clientWidth - largeur)) + 'px';
			pop.style.top = (r.bottom + 6) + 'px';
		}
		maj();
		if (!pop.dataset.suit) {
			pop.dataset.suit = '1';
			window.addEventListener('scroll', function () { if (!pop.hidden) { maj(); } }, { passive: true });
			window.addEventListener('resize', function () { if (!pop.hidden) { maj(); } });
		}
	}

	function creerPopEmojis(ta) {
		styleFenetres1740();
		var pop = document.createElement('div');
		pop.className = 'emojis-pop-1740';
		pop.hidden = true;
		pop.setAttribute('role', 'dialog');
		pop.setAttribute('aria-label', 'Emojis');
		pop.addEventListener('mousedown', function (e) { e.preventDefault(); }); // garde la position du curseur dans l'éditeur
		pop.addEventListener('click', function (e) {
			var b = e.target.closest('.emoji-1740');
			if (!b) { return; }
			insererEmoji(ta, b.dataset.e);
		});
		return pop;
	}

	/* ---------- Barre d'outils de l'éditeur : Balises et Couleur ---------- */
	var ICONE_BALISES_1740 = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7V5h16v2"></path><path d="M12 5v14"></path><path d="M9 19h6"></path></svg>';
	var ICONE_COULEUR_1740 = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.4-1.7-.3-1.2.5-2.3 1.7-2.3H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"></path><circle cx="7.5" cy="11" r="1.2" fill="currentColor"></circle><circle cx="10" cy="7" r="1.2" fill="currentColor"></circle><circle cx="15" cy="7.5" r="1.2" fill="currentColor"></circle></svg>';
	function creerPopCouleurs(ta) {
		var pop = document.createElement('div');
		pop.className = 'couleurs-pop-1740';
		pop.hidden = true;
		var id = 'cl' + (++compteurBalises1740);
		pop.innerHTML = '<div class="couleurs-ligne-1740"><label for="' + id + '">Couleur</label>'
			+ '<input type="color" id="' + id + '" value="#a9b08f" class="nuancier-1740">'
			+ '<button type="button" class="puce-1740 appliquer-1740">Appliquer</button></div>'
			+ '<div class="couleurs-titre-1740">Dernières couleurs</div>'
			+ '<span class="recentes-1740"></span>';
		pop.addEventListener('click', function (e) {
			var rec = e.target.closest('.recente-1740');
			if (rec) { appliquerCouleur(ta, rec.dataset.c); pop.hidden = true; return; }
			if (e.target.closest('.appliquer-1740')) { appliquerCouleur(ta, $('.nuancier-1740', pop).value); pop.hidden = true; }
		});
		afficherRecentes(pop);
		return pop;
	}
	function boutonBarre(cls, titre, icone, texte) {
		var a = document.createElement('a');
		a.className = 'sceditor-button ' + cls;
		a.setAttribute('role', 'button');
		a.setAttribute('tabindex', '0');
		a.setAttribute('aria-label', titre);
		a.title = titre;
		a.innerHTML = '<span class="icone-1740">' + icone + (texte ? '<span>' + texte + '</span>' : '') + '</span>';
		return a;
	}
	function brancherBarre(barreOutils, bouton, boite, pop, popE) {
		var groupe = document.createElement('div');
		groupe.className = 'sceditor-group groupe-1740';
		var bB = boutonBarre('bouton-balises-1740', 'Balises de mise en page', '', 'Balises');
		var bC = boutonBarre('bouton-couleur-1740', 'Couleur du texte', ICONE_COULEUR_1740, 'Couleur');
		var bE = boutonBarre('bouton-emojis-1740', 'Smileys', '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><circle cx="9" cy="10" r="0.9" fill="currentColor"></circle><circle cx="15" cy="10" r="0.9" fill="currentColor"></circle><path d="M8.5 14.5c1.8 2 5.2 2 7 0"></path></svg>', '');
		// Le bouton Twemoji de Forumactif fait double emploi
		$$('.sceditor-button-twemojifa, .sceditor-button-emoticon', barreOutils).forEach(function (x) { x.style.display = 'none'; });
		groupe.appendChild(bB);
		groupe.appendChild(bC);
		groupe.appendChild(bE);
		document.body.appendChild(popE);
		barreOutils.insertBefore(groupe, barreOutils.firstChild);
		// La fenêtre vit hors de la barre (qui coupe ce qui dépasse) et se place sous le bouton
		document.body.appendChild(pop);
		bouton.hidden = true;
		function basculer(el, b) {
			var ouvert;
			if (el === boite) {
				ouvert = boite.classList.toggle('ouvert-1740');
				boite.setAttribute('aria-hidden', String(!ouvert));
			} else {
				el.hidden = !el.hidden;
				ouvert = !el.hidden;
			}
			b.classList.toggle('active', ouvert);
			b.setAttribute('aria-expanded', String(ouvert));
		}
		function activer(e, f) {
			if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') { return; }
			e.preventDefault(); e.stopPropagation(); f();
		}
		['click', 'keydown'].forEach(function (t) {
			bB.addEventListener(t, function (e) { activer(e, function () { basculer(boite, bB); }); });
			bC.addEventListener(t, function (e) {
				activer(e, function () {
					if (!popE.hidden) { popE.hidden = true; bE.classList.remove('active'); }
					placerSous(pop, bC, 280);
					afficherRecentes(pop);
					basculer(pop, bC);
				});
			});
		});
		['click', 'keydown'].forEach(function (t) {
			bE.addEventListener(t, function (e) {
				activer(e, function () {
					placerSous(popE, bE, 350);
					if (popE.hidden) { remplirEmojis(popE); }
					if (!pop.hidden) { pop.hidden = true; bC.classList.remove('active'); }
					basculer(popE, bE);
				});
			});
		});
		document.addEventListener('click', function (e) {
			if (!pop.hidden && !pop.contains(e.target) && !bC.contains(e.target)) { pop.hidden = true; bC.classList.remove('active'); }
			if (!popE.hidden && !popE.contains(e.target) && !bE.contains(e.target)) { popE.hidden = true; bE.classList.remove('active'); }
		});
		document.addEventListener('keydown', function (e) {
			if (e.key !== 'Escape') { return; }
			if (!popE.hidden) { popE.hidden = true; bE.classList.remove('active'); bE.focus(); }
			if (!pop.hidden) { pop.hidden = true; bC.classList.remove('active'); bC.focus(); }
		});
	}

	/* ---------- Couleur libre : nuancier et dernières couleurs ---------- */
	var compteurBalises1740 = 0;
	function lireRecentes() {
		try { return JSON.parse(localStorage.getItem('couleurs1740') || '[]'); } catch (e) { return []; }
	}
	function afficherRecentes(boite) {
		var zone = $('.recentes-1740', boite);
		if (zone && !lireRecentes().length) { zone.innerHTML = '<span class="aucune-1740">Aucune pour l\'instant</span>'; return; }
		if (!zone) { return; }
		zone.innerHTML = lireRecentes().map(function (c) {
			return '<button type="button" class="recente-1740" data-c="' + c + '" style="background:' + c + '" title="' + c + '"><span class="lecteur-1740">' + c + '</span></button>';
		}).join('');
	}
	function appliquerCouleur(ta, c) {
		if (!/^#[0-9a-f]{6}$/i.test(c)) { return; }
		var l = lireRecentes().filter(function (x) { return x.toLowerCase() !== c.toLowerCase(); });
		l.unshift(c);
		try { localStorage.setItem('couleurs1740', JSON.stringify(l.slice(0, 10))); } catch (e) {}
		$$('.couleurs-pop-1740').forEach(afficherRecentes);
		insererBalise(ta, '[color=' + c + ']', '[/color]', 'texte');
	}

	/* ---------- Sous l'éditeur : compteur de mots et brouillon ---------- */
	function instanceEditeur(ta) {
		try { if (window.jQuery && jQuery(ta).sceditor) { return jQuery(ta).sceditor('instance') || null; } } catch (e) {}
		return null;
	}
	function valeurEditeur(ta) {
		var inst = instanceEditeur(ta);
		try { if (inst && inst.val) { return inst.val() || ''; } } catch (e) {}
		return ta.value || '';
	}
	function ecrireEditeur(ta, v) {
		var inst = instanceEditeur(ta);
		try { if (inst && inst.val) { inst.val(v); return; } } catch (e) {}
		ta.value = v;
	}
	function compterMots(v) {
		var t = v.replace(/\[\/?[a-z*][^\]]*\]/gi, '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
		return t.split(/\s+/).filter(function (m) { return /[0-9A-Za-zÀ-ÖØ-öø-ÿ]/.test(m); }).length;
	}
	function cleBrouillon() {
		var u = location.pathname + location.search;
		var m;
		if ((m = u.match(/\/t(\d+)/)) || (m = u.match(/[?&]t=(\d+)/))) { return 'brouillon1740:sujet-' + m[1]; }
		if (/mode=newtopic/.test(u) && (m = u.match(/[?&]f=(\d+)/))) { return 'brouillon1740:nouveau-' + m[1]; }
		if (/mode=editpost/.test(u) && (m = u.match(/[?&]p=(\d+)/))) { return 'brouillon1740:edition-' + m[1]; }
		if (/privmsg/.test(u)) { return 'brouillon1740:lettre-' + ((u.match(/[?&]u=(\d+)/) || u.match(/[?&]p=(\d+)/) || [0, 'nouvelle'])[1]); }
		return 'brouillon1740:' + u;
	}
	function heureCourte(d) {
		var h = d.getHours(), mn = d.getMinutes();
		return h + ' h ' + (mn < 10 ? '0' : '') + mn;
	}
	function initOutilsEcriture(ta) {
		var barre = document.createElement('div');
		barre.className = 'outils-ecriture-1740';
		barre.innerHTML = '<span class="mots-1740" aria-live="polite">0 mot</span><span class="etat-brouillon-1740"></span>';
		var cle = cleBrouillon();
		var dernier = null, aGarde = false;
		function placerBarre() {
			var cadre = $('.sceditor-container', ta.parentNode) || ta;
			if (cadre.nextSibling !== barre) { cadre.parentNode.insertBefore(barre, cadre.nextSibling); }
		}
		placerBarre();
		setTimeout(placerBarre, 1500);

		// Un brouillon attend ?
		var garde = null;
		try { garde = JSON.parse(localStorage.getItem(cle) || 'null'); } catch (e) {}
		if (garde && Date.now() - garde.d > 14 * 864e5) { try { localStorage.removeItem(cle); } catch (e) {} garde = null; }
		if (garde && garde.v) {
			setTimeout(function () {
				if (valeurEditeur(ta).trim() === garde.v.trim()) { return; }
				var avis = document.createElement('div');
				avis.className = 'brouillon-avis-1740';
				var d = new Date(garde.d);
				avis.innerHTML = '<span>Un brouillon de ' + compterMots(garde.v) + ' mots, du ' + deux(d.getDate()) + '/' + deux(d.getMonth() + 1) + ' à ' + heureCourte(d) + ', t\'attend.</span>'
					+ '<button type="button" class="puce-1740 restaurer-1740">Le reprendre</button>'
					+ '<button type="button" class="puce-1740 jeter-1740">L\'effacer</button>';
				barre.parentNode.insertBefore(avis, barre.nextSibling);
				avis.addEventListener('click', function (e) {
					if (e.target.closest('.restaurer-1740')) {
						var actuel = valeurEditeur(ta).trim();
						ecrireEditeur(ta, actuel ? actuel + '\n\n' + garde.v : garde.v);
						avis.remove();
					} else if (e.target.closest('.jeter-1740')) {
						try { localStorage.removeItem(cle); } catch (e2) {}
						avis.remove();
					}
				});
			}, 1200);
		}

		function suivre() {
			var v = valeurEditeur(ta);
			var n = compterMots(v);
			$('.mots-1740', barre).textContent = n + (n > 1 ? ' mots' : ' mot');
			if (dernier === null) { dernier = v; return; }
			if (v === dernier) { return; }
			dernier = v;
			try {
				if (v.trim()) { localStorage.setItem(cle, JSON.stringify({ v: v, d: Date.now() })); aGarde = true; }
				else if (aGarde) { localStorage.removeItem(cle); }
				$('.etat-brouillon-1740', barre).textContent = v.trim() ? 'Brouillon gardé à ' + heureCourte(new Date()) : '';
			} catch (e) {
				$('.etat-brouillon-1740', barre).textContent = 'Brouillon impossible à garder ici';
			}
		}
		setInterval(suivre, 2000);
		ta.addEventListener('input', suivre);
		// Message envoyé : le brouillon n'a plus lieu d'être (la prévisualisation le garde)
		var form = ta.form || ta.closest('form');
		if (form) {
			form.addEventListener('submit', function (e) {
				var b = e.submitter;
				if (b && /preview|prévisualis/i.test((b.name || '') + ' ' + (b.value || ''))) { return; }
				try { localStorage.removeItem(cle); } catch (e2) {}
			});
		}
	}

	/* ---------- Bouton « Copier » sur les blocs de code ---------- */
	function copierTexte(t) {
		if (navigator.clipboard && window.isSecureContext) { return navigator.clipboard.writeText(t); }
		return new Promise(function (ok, non) {
			var z = document.createElement('textarea');
			z.value = t; z.setAttribute('readonly', ''); z.style.position = 'fixed'; z.style.opacity = '0';
			document.body.appendChild(z); z.select();
			try { document.execCommand('copy') ? ok() : non(); } catch (e) { non(e); }
			z.remove();
		});
	}
	function initCopierCodes() {
		$$('dl.codebox:not(.spoiler):not(.hidecode)').forEach(function (dl) {
			var dt = $('dt', dl), code = $('code', dl);
			if (!dt || !code || $('.copier-1740', dt)) { return; }
			var b = document.createElement('button');
			b.type = 'button';
			b.className = 'copier-1740';
			b.textContent = 'Copier';
			b.setAttribute('aria-label', 'Copier le code');
			b.addEventListener('click', function () {
				copierTexte(code.innerText.replace(/ /g, ' ')).then(function () {
					b.textContent = 'Copié \u2713';
					b.classList.add('fait-1740');
				}, function () {
					b.textContent = 'Échec';
				}).then(function () {
					setTimeout(function () { b.textContent = 'Copier'; b.classList.remove('fait-1740'); }, 1800);
				});
			});
			dt.appendChild(b);
		});
	}

	/* ------------------------------------------------------------------
	   Réglages de lecture : bouton « Aa » dans la bannière.
	   Chaque choix est posé sur <html> (data-lecture-*) et gardé dans
	   localStorage (lecture1740). Le CSS est dans lecture.css.
	   ------------------------------------------------------------------ */
	var CLE_LECTURE = 'lecture1740';
	var REGLAGES_LECTURE = [
		{ cle: 'taille', nom: 'Taille du texte', choix: [['', 'Normale'], ['2', 'Grande'], ['3', 'Très grande']] },
		{ cle: 'police', nom: 'Police', choix: [['', 'Du thème'], ['lisible', 'Lisible'], ['dyslexie', 'Dyslexie']] },
		{ cle: 'espace', nom: 'Espacement', choix: [['', 'Normal'], ['aere', 'Aéré']] },
		{ cle: 'contraste', nom: 'Contraste', choix: [['', 'Normal'], ['fort', 'Renforcé']] },
		{ cle: 'mouvement', nom: 'Animations', choix: [['', 'Oui'], ['reduit', 'Réduites']] },
		{ cle: 'liens', nom: 'Liens', choix: [['', 'Normaux'], ['souligne', 'Soulignés']] }
	];

	function lireLecture() {
		var v = null;
		try { v = JSON.parse(lireStockage(CLE_LECTURE) || '{}'); } catch (e) { v = {}; }
		return v && typeof v === 'object' ? v : {};
	}

	function appliquerLecture(r) {
		var html = document.documentElement;
		REGLAGES_LECTURE.forEach(function (g) {
			if (r[g.cle]) { html.setAttribute('data-lecture-' + g.cle, r[g.cle]); }
			else { html.removeAttribute('data-lecture-' + g.cle); }
		});
	}

	function mouvementReduit() {
		return document.documentElement.getAttribute('data-lecture-mouvement') === 'reduit' ||
			!!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
	}

	function initLecture() {
		var r = lireLecture();
		appliquerLecture(r);

		var zone = $('#entete-1740 .entete-reglages');
		if (!zone) { return; }
		var bouton = $('.lecture-1740', zone);
		if (!bouton) {
			bouton = document.createElement('button');
			bouton.type = 'button';
			bouton.className = 'lecture-1740';
			bouton.textContent = 'Aa';
			var pastille = $('.pastille-1740', zone);
			if (pastille && pastille.nextSibling) { zone.insertBefore(bouton, pastille.nextSibling); }
			else { zone.insertBefore(bouton, zone.firstChild); }
		}
		bouton.setAttribute('aria-label', 'Réglages de lecture');
		bouton.title = 'Réglages de lecture';
		bouton.setAttribute('aria-haspopup', 'dialog');
		bouton.setAttribute('aria-expanded', 'false');

		var pop = document.createElement('div');
		pop.className = 'lecture-pop-1740';
		pop.id = 'lecture-pop-1740';
		pop.hidden = true;
		pop.setAttribute('role', 'dialog');
		pop.setAttribute('aria-label', 'Réglages de lecture');
		bouton.setAttribute('aria-controls', pop.id);

		var html = '<div class="lecture-corps-1740"><p class="lecture-titre-1740">Réglages de lecture</p>' +
			'<svg class="lecture-orn-1740" viewBox="0 0 60 8" width="60" height="8" aria-hidden="true"><path d="M0 4h24M36 4h24" stroke="currentColor" stroke-width="1"/><path d="M30 0l4 4-4 4-4-4z" fill="currentColor"/></svg>';
		REGLAGES_LECTURE.forEach(function (g) {
			html += '<div class="lecture-ligne-1740"><span class="lecture-nom-1740" id="lecture-nom-' + g.cle + '">' + g.nom + '</span>' +
				'<div class="lecture-choix-1740" role="group" aria-labelledby="lecture-nom-' + g.cle + '" data-reglage="' + g.cle + '">';
			g.choix.forEach(function (c) {
				html += '<button type="button" data-valeur="' + c[0] + '" aria-pressed="false">' + c[1] + '</button>';
			});
			html += '</div></div>';
		});
		html += '<div class="lecture-pied-1740"><span>Gardé sur cet appareil</span><button type="button" class="lecture-retablir-1740">Rétablir</button></div></div>';
		pop.innerHTML = html;
		document.body.appendChild(pop);

		function majBoutons() {
			var actif = false;
			$$('.lecture-choix-1740', pop).forEach(function (groupe) {
				var cle = groupe.getAttribute('data-reglage');
				var val = r[cle] || '';
				if (val) { actif = true; }
				$$('button', groupe).forEach(function (b) {
					b.setAttribute('aria-pressed', b.getAttribute('data-valeur') === val ? 'true' : 'false');
				});
			});
			bouton.classList.toggle('actif-1740', actif);
		}

		function enregistrer() {
			ecrireStockage(CLE_LECTURE, JSON.stringify(r));
			appliquerLecture(r);
			majBoutons();
			placer();
		}

		function placer() {
			var b = bouton.getBoundingClientRect();
			var largeur = document.documentElement.clientWidth;
			pop.style.top = (b.bottom + window.pageYOffset + 6) + 'px';
			pop.style.right = Math.max(8, largeur - b.right) + 'px';
			pop.style.left = 'auto';
		}

		function ouvrir() {
			pop.hidden = false;
			placer();
			bouton.setAttribute('aria-expanded', 'true');
			requestAnimationFrame(function () { pop.classList.add('ouvert-1740'); });
			var premier = $('button[aria-pressed="true"]', pop) || $('button', pop);
			if (premier) { premier.focus(); }
		}

		function fermer(rendreFocus) {
			if (pop.hidden) { return; }
			pop.classList.remove('ouvert-1740');
			pop.hidden = true;
			bouton.setAttribute('aria-expanded', 'false');
			if (rendreFocus) { bouton.focus(); }
		}

		bouton.addEventListener('click', function (e) {
			e.stopPropagation();
			if (pop.hidden) { ouvrir(); } else { fermer(false); }
		});

		pop.addEventListener('click', function (e) {
			e.stopPropagation();
			var b = e.target.closest('button');
			if (!b) { return; }
			if (b.classList.contains('lecture-retablir-1740')) {
				r = {};
				enregistrer();
				return;
			}
			var groupe = b.closest('.lecture-choix-1740');
			if (!groupe) { return; }
			var cle = groupe.getAttribute('data-reglage');
			var val = b.getAttribute('data-valeur');
			if (val) { r[cle] = val; } else { delete r[cle]; }
			enregistrer();
		});

		document.addEventListener('click', function (e) {
			if (!pop.hidden && !pop.contains(e.target) && e.target !== bouton) { fermer(false); }
		});
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && !pop.hidden) { fermer(true); }
		});
		window.addEventListener('resize', function () { if (!pop.hidden) { placer(); } });

		majBoutons();
	}

	function demarrer() {
		document.documentElement.classList.add('theme-1740');
		lireReglages();
		initThemes();
		initLecture();
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
		if ($('.post-1740')) { initSujet(); }
		if ($('.forum-tete-1740')) { initListe(); }
		initProgression();
		if ($('.lettres-tete-1740')) { initLettres(); initOngletsLettres(); }
		titresEcriture();
		if ($('.ames-1740')) { initRecensement(); }
		if ($('#text_editor_textarea')) { initEditeur(); }
		retirerTopicit();
		enteteProfil();
		initSurveilles();
		retirerDates();
		tetesSecondaires();
		initRecherche();
		initSondage();
		nettoyerEditions();
		initCodes();
		initBalisesEditeur();
		initCopierCodes();
	}

	if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', demarrer); }
	else { demarrer(); }
})();
