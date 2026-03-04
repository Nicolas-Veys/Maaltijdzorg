// ==UserScript==
// @name         Maaltijdzorg - UI Fix & Refined Styling
// @namespace    http://tampermonkey.net/
// @version      4.14
// @description  Fixed ZZ attachment, bold Menu line, and grey "Andere info" section.
// @author       You
// @match        https://mijn.maaltijdzorgplatform.be/Route/Rijden*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Nicolas-Veys/Maaltijdzorg/main/Maaltijdzorg.user.js
// @downloadURL  https://raw.githubusercontent.com/Nicolas-Veys/Maaltijdzorg/main/Maaltijdzorg.user.js
// ==/UserScript==

(function() {
    'use strict';

    const THEME_COLOR = '#34a853';
    const PICKUP_COLOR = '#f1c40f';

    function getTodayString() { return new Date().toLocaleDateString('nl-BE'); }
    function loadPickupData() {
        let data = JSON.parse(localStorage.getItem('tm_pickup_data') || 'null');
        if (!data || data.date !== getTodayString()) return { date: getTodayString(), normal: [], extra: [] };
        return data;
    }
    function savePickupData(data) { localStorage.setItem('tm_pickup_data', JSON.stringify(data)); }

    // Swap to "last part first": e.g. "Jorissen Gemma Catherine" → "Catherine Gemma Jorissen". Handles compound surnames (De, Van, Van den, etc.).
    function swapDisplayName(fullName) {
        if (!fullName || typeof fullName !== 'string') return fullName;
        const match = fullName.match(/^(\d+\.\s*)?(.*)$/);
        const prefix = (match && match[1]) ? match[1] : '';
        const name = (match && match[2]) ? match[2].trim() : fullName.trim();
        const words = name.split(/\s+/).filter(Boolean);
        if (words.length < 2) return fullName;
        // Build parts: compound surname as one part (e.g. "De Wulf", "Van Renterghem"), then single words; then reverse order
        const parts = [];
        let i = 0;
        while (i < words.length) {
            if (i + 2 < words.length && words[i] === 'Van' && (words[i + 1] === 'den' || words[i + 1] === 'de' || words[i + 1] === 'der')) {
                parts.push(words[i] + ' ' + words[i + 1] + ' ' + words[i + 2]);
                i += 3;
            } else if (i + 1 < words.length && ['De', 'Van', 'Le', 'La', 'Den', 'Het'].indexOf(words[i]) !== -1) {
                parts.push(words[i] + ' ' + words[i + 1]);
                i += 2;
            } else {
                parts.push(words[i]);
                i += 1;
            }
        }
        return prefix + parts.reverse().join(' ');
    }

    function applyPickupsToUI() {
        const data = loadPickupData();
        document.querySelectorAll('.tm-pickup-tag').forEach(el => el.remove());
        document.querySelectorAll('.tm-extra-pickup-row').forEach(el => el.remove());

        document.querySelectorAll('.tm-client-header-container').forEach(h => {
            if (data.normal.includes(h.dataset.clientName)) {
                h.innerHTML += '<div class="tm-pickup-tag">menu ophalen</div>';
            }
        });

        data.extra.forEach(ext => {
            const allRows = Array.from(document.querySelectorAll('div.client.row, div.tm-extra-pickup-row'));
            const extraRow = document.createElement('div');
            extraRow.className = 'client row tm-extra-pickup-row';
            extraRow.style = "margin: 0; padding: 15px 0; background-color: #fff9d6; text-align: left; clear:both; position: relative; left: 50%; right: 50%; margin-left: -50vw; margin-right: -50vw; width: 100vw; box-sizing: border-box;";

            const hasAddress = !!(ext.address && ext.address.trim());
            const mapsBtnHtml = hasAddress
                ? `<button class="btn tm-maps-btn" onclick="window.open('https://www.google.com/maps?q=${encodeURIComponent(ext.address || '')}', '_blank')">📍</button>`
                : '';

            extraRow.innerHTML = `<div class="col" style="text-align: left;">
                <div class="tm-button-cluster">${mapsBtnHtml}</div>
                <div class="tm-client-header-container" data-client-name="${ext.name}">
                    <strong>${ext.name}</strong><br>${ext.address || ''}<br><div class="tm-pickup-tag">menu ophalen</div>
                </div>
            </div>`;

            if (ext.after === '__FIRST__') {
                const firstClientRow = allRows.find(r => r.classList.contains('client') && r.classList.contains('row') && !r.classList.contains('tm-extra-pickup-row'));
                if (firstClientRow) {
                    firstClientRow.before(extraRow);
                }
            } else {
                const targetRow = allRows.find(r => {
                    const h = r.querySelector('.tm-client-header-container');
                    return h && h.dataset.clientName === ext.after;
                });
                if (targetRow) {
                    targetRow.after(extraRow);
                }
            }
        });
    }

    function processColumns() {
        const DIETARY_CODES = ["avvz", "vgvis", "gnvis", "dia", "lv", "gesneden", "vlgmi", "gemixt"];

        if (!document.getElementById('tm-pickup-manager-btn')) {
            const firstRow = document.querySelector('div.client.row');
            if (firstRow) {
                const btn = document.createElement('button');
                btn.id = 'tm-pickup-manager-btn';
                btn.innerHTML = '📋 Menu Pickups Instellen';
                btn.style = `display: block; width: calc(100% - 20px); margin: 10px auto; padding: 15px; background: ${PICKUP_COLOR}; color: #333; border: 2px solid #d4ac0d; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1.1rem; text-align: center;`;
                btn.onclick = openPickupManager;
                firstRow.parentNode.insertBefore(btn, firstRow);
            }
        }

        const rows = document.querySelectorAll('div.client.row:not([data-tm-processed]):not(.tm-extra-pickup-row)');
        if (rows.length === 0) return;

        const dessertFrequency = {};
        document.querySelectorAll('div.col').forEach(col => {
            // Support both 1- and 2-digit day/month: e.g. 1/03/2026: or 01/03/2026:
            const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}:/g;
            const blocks = col.innerHTML.split(/(?=\d{1,2}\/\d{1,2}\/\d{4}:)/);
            blocks.forEach(block => {
                const dateMatch = block.match(dateRegex);
                if (!dateMatch || block.toLowerCase().includes("geen maaltijd")) return;
                const date = dateMatch[0].replace(':', '');
                const items = block.split(';').map(i => i.replace(/<[^>]*>/g, '').trim()).filter(i => i !== "");
                let foundDessert = "";
                items.forEach(item => {
                    const low = item.toLowerCase();
                    if (!low.includes('[') && !low.includes('soep') && !low.includes('+') && !low.includes('geen g') && !DIETARY_CODES.some(code => low.includes(code)) && low !== date.toLowerCase()) {
                        if (!foundDessert) foundDessert = item;
                    }
                });
                if (foundDessert) {
                    if (!dessertFrequency[date]) dessertFrequency[date] = {};
                    dessertFrequency[date][foundDessert] = (dessertFrequency[date][foundDessert] || 0) + 1;
                }
            });
        });

        const dailyStandard = {};
        for (const date in dessertFrequency) {
            dailyStandard[date] = Object.keys(dessertFrequency[date]).reduce((a, b) => dessertFrequency[date][a] > dessertFrequency[date][b] ? a : b);
        }

        rows.forEach(row => {
            const mainCol = row.querySelector('div.col');
            const sideCol = row.querySelector('div.col-3');
            if (!mainCol) return;

            const originalMainHTML = mainCol.innerHTML;
            const originalSideHTML = sideCol ? sideCol.innerHTML : '';

            // Fix ZZ formatting: remove space/dot before [ZZ]
            let html = mainCol.innerHTML.replace(/\s*\.?\s*za\b/gi, "[ZZ]");

            const actionButtons = sideCol ? Array.from(sideCol.querySelectorAll(':scope > button, :scope > a')) : [];
            const modals = sideCol ? Array.from(sideCol.querySelectorAll('.modal')) : [];

            const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}:/g;
            const firstDateMatch = html.match(dateRegex);
            if (!firstDateMatch) { row.setAttribute('data-tm-processed', 'true'); return; }

            const addressEndIndex = html.indexOf(firstDateMatch[0]);
            const nameAndAddressHtml = html.substring(0, addressEndIndex);
            const addressLines = nameAndAddressHtml.split('<br>').map(s => s.replace(/<[^>]*>/g, '').trim()).filter(s => s !== "");
            const rawClientName = addressLines[0];
            const streetAndCity = addressLines.slice(1).join(', ');

            const mapsBtn = document.createElement('button');
            mapsBtn.className = 'btn tm-maps-btn';
            mapsBtn.innerHTML = '📍';
            mapsBtn.onclick = () => window.open(`https://www.google.com/maps?q=${encodeURIComponent(streetAndCity)}`, '_blank');

            const infoStartIndex = html.indexOf('<strong>Klant-info:</strong>');
            const menuSectionRaw = html.substring(addressEndIndex, infoStartIndex > -1 ? infoStartIndex : html.length);
            const remainingHtml = infoStartIndex > -1 ? html.substring(infoStartIndex) : "";

            const dayBlocks = menuSectionRaw.split(/(?=\d{1,2}\/\d{1,2}\/\d{4}:)/).filter(b => b.trim() !== "");
            let cardsHtml = "";
            let rowWarm = 0, rowCold = 0, rowSoups = 0, rowSoupsZZ = 0;
            dayBlocks.forEach(block => {
                const dateHeaderRaw = block.match(dateRegex)[0];
                const dateKey = dateHeaderRaw.replace(':', '');
                const contentRaw = block.replace(dateHeaderRaw, "").trim();
                let dayCardBody = "";

                if (contentRaw.toLowerCase().includes("geen maaltijd")) {
                    dayCardBody = `<div class="tm-no-meal">[Geen maaltijd]</div>`;
                } else {
                    const items = contentRaw.split(';').map(item => item.replace(/<[^>]*>/g, '').trim()).filter(item => item !== "");
                    let menuLabel = "Onbekend", soep = "Gewoon", dessert = "", andere = [], soepIsEx = false, menuClass = "tm-menu-default", blockHasSoepZZ = false;

                    items.forEach(item => {
                        const low = item.toLowerCase();
                        const hasZZ = item.includes('[ZZ]');
                        // Clean up internal spacing for ZZ
                        let cleanedItem = item.replace(/\s*\.\s*\[ZZ\]/gi, '[ZZ]').replace(/\s+\[ZZ\]/gi, '[ZZ]');
                        const zzOnly = cleanedItem.replace(/\[ZZ\]/gi, '').trim() === "";
                        if (zzOnly) {
                            return;
                        }

                        if (item.includes('[') && item.includes(']') && !hasZZ) {
                            const match = item.match(/\[([A-F])\]/i);
                            if (match) {
                                const char = match[1].toUpperCase();
                                if (char === 'A' || char === 'B') { menuLabel = char + " - warm"; menuClass = "tm-menu-warm"; }
                                else if (char === 'C' || char === 'D') { menuLabel = char + " - koud"; menuClass = "tm-menu-koud"; }
                                else { menuLabel = char + " - warm"; }
                            }
                        }
                        else if (low.includes('soep') || low.includes('gn g') || low.includes('geen g')) {
                            soepIsEx = true;
                            if (low.includes('gn g') || low.includes('geen g')) {
                                soep = "geen soep";
                            } else {
                                if (hasZZ) blockHasSoepZZ = true;
                                let sName = cleanedItem.replace(/soep/gi, '').trim();
                                soep = sName || "Gewoon";
                            }
                        }
                        else if (DIETARY_CODES.some(code => low.includes(code))) { andere.push(cleanedItem); }
                        else if (dessert === "" && low !== "" && !hasZZ) { dessert = cleanedItem; }
                        else if (low !== "" && !hasZZ) { andere.push(cleanedItem); }
                    });

                    if (menuClass === "tm-menu-warm") rowWarm++;
                    else if (menuClass === "tm-menu-koud") rowCold++;
                    if (soep !== "geen soep") rowSoups++;
                    if (blockHasSoepZZ) rowSoupsZZ++;

                    const isSpecial = dessert && dailyStandard[dateKey] && dessert !== dailyStandard[dateKey];
                    dayCardBody = `<div class="tm-meal-row tm-menu-line"><strong>Menu:</strong> <span class="${menuClass}">${menuLabel}</span></div>
                                   <div class="tm-meal-row"><strong>Soep:</strong> <span class="${soepIsEx ? 'tm-soep-highlight' : ''}">${soep}</span></div>
                                   <div class="tm-meal-row"><strong>Dessert:</strong> <span class="${isSpecial ? 'tm-dessert-special' : ''}">${dessert || "Geen"}</span></div>
                                   ${andere.length > 0 ? `<div class="tm-extra-info"><strong>Andere info:</strong> ${andere.join(", ")}</div>` : ''}`;
                }
                cardsHtml += `<div class="tm-day-card"><div class="tm-date-header">${dateKey}</div>${dayCardBody}</div>`;
            });
            row.dataset.tmWarm = rowWarm;
            row.dataset.tmCold = rowCold;
            row.dataset.tmSoups = rowSoups;
            row.dataset.tmSoupsZz = rowSoupsZZ;

            mainCol.innerHTML = "";
            mainCol.style.textAlign = "left";

            const btnCluster = document.createElement('div');
            btnCluster.className = 'tm-button-cluster';
            btnCluster.appendChild(mapsBtn);

            actionButtons.forEach(btn => {
                btn.classList.remove('btn-lg', 'mt-auto', 'mb-auto');
                btnCluster.appendChild(btn);

                if (btn.innerText.toLowerCase().includes('info') || btn.innerText.toLowerCase().includes('detail')) {
                    const origBtn = btn.cloneNode(true);
                    origBtn.innerHTML = "⏪ Origineel";
                    origBtn.removeAttribute('onclick');
                    origBtn.onclick = (e) => {
                        e.preventDefault();
                        const win = window.open("", "_blank", "width=800,height=600");
                        win.document.write(`<html><head><title>Origineel</title><link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css"></head><body style="padding:20px;"><h3>Originele Info</h3><hr><div class="row"><div class="col">${originalMainHTML}</div><div class="col-3">${originalSideHTML}</div></div></body></html>`);
                    };
                    btnCluster.appendChild(origBtn);
                }
            });

            mainCol.appendChild(btnCluster);

            const headDiv = document.createElement('div');
            headDiv.className = 'tm-client-header-container';
            headDiv.dataset.clientName = rawClientName;
            headDiv.innerHTML = nameAndAddressHtml;
            mainCol.appendChild(headDiv);

            const bodyDiv = document.createElement('div');
            let dropdownHtml = "";
            if (remainingHtml.includes("<strong>Klant-info:</strong>")) {
                const parts = remainingHtml.split("<strong>Klant-info:</strong>");
                dropdownHtml = `<details class="tm-klant-dropdown"><summary>Klant-info </summary><div class="tm-klant-content"><strong>Klant-info:</strong>${parts[1]}</div></details>`;
            }
            bodyDiv.innerHTML = cardsHtml + dropdownHtml;
            mainCol.appendChild(bodyDiv);

            modals.forEach(modal => mainCol.appendChild(modal));
            if (sideCol) sideCol.remove();
            row.setAttribute('data-tm-processed', 'true');
        });

        applyPickupsToUI();

        // Totals summary at top: sum from all client rows (processed, with data attributes)
        let totalWarm = 0, totalCold = 0, totalSoups = 0, totalSoupsZZ = 0;
        document.querySelectorAll('div.client.row:not(.tm-extra-pickup-row)').forEach(r => {
            totalWarm += parseInt(r.dataset.tmWarm || '0', 10);
            totalCold += parseInt(r.dataset.tmCold || '0', 10);
            totalSoups += parseInt(r.dataset.tmSoups || '0', 10);
            totalSoupsZZ += parseInt(r.dataset.tmSoupsZz || '0', 10);
        });
        const container = document.querySelector('.container.text-center.py-5') || document.querySelector('main .container');
        if (container) {
            let summaryEl = document.getElementById('tm-meal-summary');
            if (!summaryEl) {
                summaryEl = document.createElement('div');
                summaryEl.id = 'tm-meal-summary';
                summaryEl.className = 'tm-meal-summary';
                const firstChild = container.querySelector('h1');
                container.insertBefore(summaryEl, firstChild ? firstChild.nextSibling : container.firstChild);
            }
            summaryEl.innerHTML = `
                <div class="tm-summary-line"><strong>Totaal warme maaltijden (A+B):</strong> ${totalWarm}</div>
                <div class="tm-summary-line"><strong>Totaal koude maaltijden (C+D):</strong> ${totalCold}</div>
                <div class="tm-summary-line"><strong>Totaal soepen:</strong> ${totalSoups}</div>
                <div class="tm-summary-line"><strong>Soepen ZZ:</strong> ${totalSoupsZZ}</div>
            `;
        }
    }

    function openPickupManager() {
        const data = loadPickupData();
        const clients = [];
        document.querySelectorAll('.tm-client-header-container').forEach((h) => {
            const name = h.dataset.clientName;
            if(name && !clients.includes(name) && !h.closest('.tm-extra-pickup-row')) clients.push(name);
        });

        // Build route order so "na wie" options and list mirror actual sequence:
        // start with base clients, then handle extras, including those before the first client.
        const FIRST_ANCHOR = '__FIRST__';
        const routeOrder = clients.slice();
        data.extra.forEach(ext => {
            if (!ext.name) return;
            if (ext.after === FIRST_ANCHOR) {
                if (!routeOrder.includes(ext.name)) {
                    routeOrder.unshift(ext.name);
                }
                return;
            }
            const anchorIndex = routeOrder.indexOf(ext.after);
            if (anchorIndex !== -1) {
                if (!routeOrder.includes(ext.name)) {
                    routeOrder.splice(anchorIndex + 1, 0, ext.name);
                }
            } else if (!routeOrder.includes(ext.name)) {
                routeOrder.push(ext.name);
            }
        });

        const overlay = document.createElement('div');
        overlay.id = 'tm-overlay';
        overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9999; display:flex; align-items:center; justify-content:center;";
        const modal = document.createElement('div');
        modal.style = "background:white; padding:20px; border-radius:10px; width:95%; max-width:400px; max-height:85vh; overflow-y:auto;";

        let listHtml = '<h3>Menu ophalen bij:</h3>';
        // Single unified list in route order:
        routeOrder.forEach(name => {
            if (clients.includes(name)) {
                // Base client: checkbox to mark pickup (display name: first + middle, last)
                const isChecked = data.normal.includes(name) ? 'checked' : '';
                listHtml += `<div style="margin-bottom:8px;"><label><input type="checkbox" class="tm-pickup-check" value="${name}" ${isChecked}> ${swapDisplayName(name)}</label></div>`;
            } else {
                // Extra stop: only name visible here, with remove icon button on the left
                const idx = data.extra.findIndex(ext => ext.name === name);
                const ext = idx >= 0 ? data.extra[idx] : { name };
                listHtml += `<div style="margin-bottom:8px; display:flex; align-items:center;">
                                <button type="button" class="tm-extra-remove-btn" data-extra-index="${idx}">
                                    ✖
                                </button>
                                <span>${swapDisplayName(ext.name)}</span>
                             </div>`;
            }
        });

        listHtml += '<hr><h4>Extra Stop</h4><input type="text" id="tm-ex-name" placeholder="Naam" style="width:100%; margin-bottom:8px;"><input type="text" id="tm-ex-addr" placeholder="Adres (optioneel)" style="width:100%; margin-bottom:8px;"><select id="tm-ex-after" style="width:100%; margin-bottom:8px;"><option value="">-- Na wie? --</option>';
        routeOrder.forEach(name => listHtml += `<option value="${name}">${swapDisplayName(name)}</option>`);
        listHtml += '</select><button id="tm-ex-before-first" style="width:100%; margin-bottom:8px; background:#eeeeee; color:#333; border:none; padding:8px;">Voor eerste klant</button><button id="tm-save-all" style="width:100%; margin-top:10px; background:#34a853; color:white; border:none; padding:10px;">Opslaan</button><button id="tm-close-all" style="width:100%; margin-top:8px; background:#cccccc; color:#333; border:none; padding:10px;">Sluiten</button>';

        modal.innerHTML = listHtml;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close when clicking outside the modal
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.getElementById('tm-overlay')?.remove();
            }
        });

        // Live clear error state on "Na wie?" when user selects a value
        const exAfterSelect = document.getElementById('tm-ex-after');
        if (exAfterSelect) {
            exAfterSelect.addEventListener('change', () => {
                exAfterSelect.classList.remove('tm-ex-after-error');
            });
        }

        document.getElementById('tm-save-all').onclick = () => {
            data.normal = Array.from(document.querySelectorAll('.tm-pickup-check:checked')).map(c => c.value);
            const n = document.getElementById('tm-ex-name').value;
            const afterSelect = document.getElementById('tm-ex-after');
            const a = afterSelect.value;

            // Clear previous error state on "Na wie?"
            if (afterSelect) {
                afterSelect.classList.remove('tm-ex-after-error');
            }

            // If a name is entered but no "Na wie" is chosen, show visual error and do nothing else
            if (n && !a) {
                if (afterSelect) {
                    afterSelect.classList.add('tm-ex-after-error');
                    afterSelect.focus();
                }
                return;
            }

            if (n && a) {
                data.extra.push({ name: n, address: document.getElementById('tm-ex-addr').value, after: a });
            }
            savePickupData(data);
            applyPickupsToUI();
            // Reopen manager so popup stays visible and reflects new/updated stops
            document.getElementById('tm-overlay')?.remove();
            openPickupManager();
        };

        // Button to add an extra stop before the very first client
        const beforeFirstBtn = document.getElementById('tm-ex-before-first');
        if (beforeFirstBtn) {
            beforeFirstBtn.onclick = () => {
                const n = document.getElementById('tm-ex-name').value;
                const addr = document.getElementById('tm-ex-addr').value;
                const afterSelect = document.getElementById('tm-ex-after');

                // Clear any previous "Na wie" error styling
                if (afterSelect) {
                    afterSelect.classList.remove('tm-ex-after-error');
                }

                if (!n) {
                    document.getElementById('tm-ex-name').focus();
                    return;
                }

                data.extra.push({ name: n, address: addr, after: '__FIRST__' });
                savePickupData(data);
                applyPickupsToUI();
                document.getElementById('tm-overlay')?.remove();
                openPickupManager();
            };
        }

        // Remove existing extra stop buttons (keep manager open by re-rendering it)
        document.querySelectorAll('.tm-extra-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-extra-index'), 10);
                if (!isNaN(idx)) {
                    const removed = data.extra[idx];
                    // Remove the selected extra stop
                    data.extra.splice(idx, 1);
                    // Any extra that was after the removed one should now be after the removed one's anchor
                    if (removed && removed.name) {
                        data.extra.forEach(ext => {
                            if (ext.after === removed.name) {
                                ext.after = removed.after;
                            }
                        });
                    }
                    savePickupData(data);
                    applyPickupsToUI();
                    // Reopen manager with updated data so popup stays visible
                    document.getElementById('tm-overlay')?.remove();
                    openPickupManager();
                }
            });
        });

        // Close button without saving
        document.getElementById('tm-close-all').onclick = () => {
            document.getElementById('tm-overlay')?.remove();
        };
    }

    const style = document.createElement('style');
    style.innerHTML = `
        .tm-meal-summary { display: flex; flex-wrap: wrap; gap: 1rem 2rem; margin-bottom: 1rem; padding: 0.75rem 1rem; background: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6; }
        .tm-summary-line { font-size: 1rem; }
        .tm-button-cluster { float: right; display: flex; flex-direction: row; gap: 8px; margin-left: 10px; }
        .tm-button-cluster .btn, .tm-button-cluster a {
            display: inline-flex !important; align-items: center; justify-content: center;
            min-width: 48px !important; height: 48px !important;
            padding: 10px !important; font-size: 1.1rem; border-radius: 8px; font-weight: bold;
        }
        .tm-maps-btn { background-color: #540429 !important; color: white !important; }
        .tm-day-card { clear: both; background: #fff; border: 1px solid #ddd; border-radius: 6px; margin: 8px 0; padding: 10px; }
        .tm-date-header { font-weight: bold; border-bottom: 1px solid #eee; margin-bottom: 5px; }
        .tm-menu-line { font-weight: bold; }
        .tm-menu-warm { background-color: #f8d7da; color: #721c24; padding: 1px 4px; border-radius: 4px; }
        .tm-menu-koud { background-color: #a2d9e7; color: #0c5460; padding: 1px 4px; border-radius: 4px; }
        .tm-soep-highlight { background-color: #fff3cd; font-weight: bold; padding: 1px 4px; border-radius: 4px; }
        .tm-dessert-special { background-color: #ffe8cc; font-weight: bold; padding: 1px 4px; border-radius: 4px; }
        .tm-extra-info { color: #888; margin-top: 5px; font-size: 0.95em; }
        .tm-pickup-tag { background: ${PICKUP_COLOR}; color: #333; padding: 4px 8px; font-weight: bold; border-radius: 4px; display: inline-block; margin-top: 5px; }
        .tm-pickup-check {
            width: 26px;
            height: 26px;
            margin-right: 8px;
        }
        .tm-extra-remove-btn {
            width: 26px;
            height: 26px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            margin-right: 8px;
            background: transparent;
            color: #d00000;
            border: none;
            border-radius: 0;
            font-size: 22px;
            font-weight: 900;
            line-height: 1;
        }
        .tm-ex-after-error {
            border: 2px solid #d00000 !important;
            background-color: #ffe5e5 !important;
        }
        .tm-klant-dropdown { margin-top: 10px; border: 1px solid #ccc; border-radius: 5px; background: #fdfdfd; }
        .tm-klant-dropdown summary { cursor: pointer; font-weight: bold; color: #0056b3; padding: 5px; }
        .tm-klant-content { padding: 8px; border-top: 1px solid #eee; background: white; }
    `;
    document.head.appendChild(style);

    const observer = new MutationObserver(() => processColumns());
    observer.observe(document.body, { childList: true, subtree: true });
    processColumns();
})();
