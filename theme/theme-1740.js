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
			var texte = joue ? 'Couper l’ambiance sonore' : 'Jouer l’ambiance sonore';
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
			// Seul le premier nœud texte contient la date (le reste : votes éventuels)
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

		// « Utilisateurs parcourant actuellement ce forum : » → seulement les noms
		var parcourent = $('.parcourent-texte-1740');
		if (parcourent) {
			var premier = parcourent.firstChild;
			while (premier && !(premier.nodeType === 3 && premier.nodeValue.trim())) { premier = premier.nextSibling; }
			if (premier && /:\s*$/.test(premier.nodeValue)) { premier.nodeValue = ''; }
		}

		var I = window.FA_SUJETS_1740 || {};
		function parmi(liste, src) { return (liste || []).some(function (x) { return memeImage(src, x); }); }
		function etatDe(li) {
			var src = li.getAttribute('data-icone') || '';
			var type = ($('.sujet-type-1740', li) || {}).textContent || '';
			if (/annonce/i.test(type) || parmi(I.annonce, src)) { return 'annonce'; }
			if (/note|post-it|épingl/i.test(type) || parmi(I.epingle, src)) { return 'epingle'; }
			if (parmi(I.scelle, src)) { return 'scelle'; }
			if (parmi(I.nouveau, src)) { return 'nouveau'; }
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
			var total = etapes.reduce(function (t, e) { return t + (e.etat === 'fait' || e.etat === 'dernier' ? e.part : 0); }, 0);
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

		// « Votre boîte de réception est pleine à 2% » → « Coffret rempli à 2 % »
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

		// Lettre ouverte : « Correspondance de [expéditeur] », « A » → « à »
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
			if (connu && Date.now() - connu.t < UNE_JOURNEE) { fc.textContent = connu.v || '—'; return; }
			var charge = false;
			function charger() {
				if (charge || !window.fetch) { return; }
				charge = true;
				fetch(url, { credentials: 'same-origin' })
					.then(function (r) { return r.text(); })
					.then(function (html) {
						var v = lireFaceclaim(html);
						fc.textContent = v || '—';
						memoire[url] = { v: v, t: Date.now() };
						try { localStorage.setItem('faceclaims1740', JSON.stringify(memoire)); } catch (e) {}
					})
					.catch(function () { fc.textContent = '—'; charge = false; });
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

	/* ---------- Onglets du profil : on retire ceux qui ne servent pas ---------- */
	function nettoyerOngletsProfil() {
		var inutiles = /^(amis et ignorés|membres suivis|favoris)$/i;
		$$('#main-content a[href*="page_profil"], #main-content a[href*="mode=editprofile"]').forEach(function (a) {
			if (!inutiles.test(a.textContent.trim())) { return; }
			var li = a.closest('li') || a;
			li.style.display = 'none';
		});
	}

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
		if ($('.post-1740')) { initSujet(); }
		if ($('.forum-tete-1740')) { initListe(); }
		initProgression();
		if ($('.lettres-tete-1740')) { initLettres(); initOngletsLettres(); }
		titresEcriture();
		if ($('.ames-1740')) { initRecensement(); }
		if ($('#text_editor_textarea')) { initEditeur(); }
		retirerTopicit();
		nettoyerOngletsProfil();
	}

	if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', demarrer); }
	else { demarrer(); }
})();
