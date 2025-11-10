// CookiStocker — single-file, CCSE-safe, save/load-safe build
// -----------------------------------------------------------
// Fixes:
// 1) ReplaceGameMenu defined before use; CCSE wait is guarded
// 2) Null-safe achievement reads; skip creation if CCSE absent
// 3) save()/load() implemented on the registered mod object (no missing global)
// 4) Timers/hooks torn down & rebuilt across ascension / save reloads
// 5) Defensive checks around Bank minigame presence

(function () {
	"use strict";

	// --- CC constants ---
	const CS_TEN_YEARS = 86400 * 365.25 * 10;     // seconds
	const CS_GASEOUS_PROFITS = 31536000;          // $31,536,000
	const CS_PLASMIC_PROFITS = 100000000;         // $100,000,000
	const CS_BOSE_EINSTEIN_PROFITS = 500000000;   // $500,000,000
	const modeDecoder = ['stable','slowly rising','slowly falling','rapidly rising','rapidly falling','chaotic'];
	const goodIcons = [[2,33],[3,33],[4,33],[15,33],[16,33],[17,33],[5,33],[6,33],[7,33],[8,33],[13,33],[14,33],[19,33],[20,33],[32,33],[33,33],[34,33],[35,33]];

	// --- ensure CCSE if missing (steam path) ---
	if (typeof CCSE === 'undefined' && typeof Game !== 'undefined' && Game && typeof Game.LoadMod === 'function'){
		try { Game.LoadMod('https://klattmose.github.io/CookieClicker/SteamMods/CCSE/main.js'); } catch(e){}
	}

	// --- Helpers from game env we will call often ---
	const l = function(id){ return document.getElementById(id); }; // Cookie Clicker helper alias

	function ensureStockerStyles(){
		if (document.getElementById('stocker-styles')) return;
		const css = `
			.stocker-stats{display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:0 3px;white-space:normal}
			.stocker-stats .stat{white-space:nowrap;font-size:10px;color:rgba(255,255,255,0.8);padding:1px 3px}
			.stocker-stats .break{flex-basis:100%;height:0}
			@media (min-width:950px){.stocker-stats .break{display:none}}
		`;
		const style = document.createElement('style');
		style.id = 'stocker-styles';
		style.textContent = css;
		document.head.appendChild(style);
	}

	// --- Module object declared and fully populated BEFORE registration ---
	const CookiStocker = {
		name: 'CookiStocker',
		version: '3.0.3-fixed',
		GameVersion: '2.053',
		build: 'Mon 2025-11-10',

		// Options (defaults)
		stockerAutoTrading: true,
		stockerMarketOn: true,
		stockerMinBrokers: 72,
		stockerCookiesThreshold: 0.05,
		stockerAutoBuyMinimumBrokers: true,
		stockerAutoBuyAdditionalBrokers: true,
		stockerExponential: true,
		stockerExponentialPower: 1.0,
		stockerTransactionNotifications: true,
		stockerActivityReport: false,
		stockerActivityReportFrequency: 1000 * 60 * 60,
		stockerFastNotifications: false,
		stockerConsoleAnnouncements: false,
		stockerResourcesWarning: true,
		stockerAdditionalTradingStats: true,
		stockerLoopFrequency: 1000 * 30,
		stockerForceLoopUpdates: false,
		stockerGreeting: 'click clack you will soon be in debt',

		// Runtime
		Bank: 0,
		isLoaded: 0,
		LoopHandle: 0,
		_tickHookInstalled: 0,
		_tickTimeout: 0,
		_reportTimeout: 0,
		reportTimer: 0,
		_reportEveryMs: 0,
		extraStatsId: 'stockerExtra',
		patchedMaxStock: false,

		// persistent data structure
		stockList: {
			Check: 'dump eet',
			Goods: [],
			Start: Date.now() + 500,
			lastTime: Date.now() + 500,
			startingProfits: 0,
			Profits: 0,
			netProfits: 0,
			grossProfits: 0,
			grossLosses: 0,
			totalStocks: 0,
			totalShares: 0,
			totalValue: 0,
			unrealizedProfits: 0,
			profitableStocks: 0,
			unprofitableStocks: 0,
			profitableTrades: 0,
			unprofitableTrades: 0,
			Purchases: 0,
			Sales: 0,
			Uptime: 0,
			hourlyProfits: 0,
			dailyProfits: 0,
			minCookies: Number.MAX_VALUE,
			maxCookies: 0,
			noModActions: false,
			origCookiesPsRawHighest: 0,
			Amount: 0,
			canBuy: true,
			shadowGone: false,
		},

		stockerModeProfits:
			Array.from({length:6},()=>Array.from({length:6},()=>[0,0,0])),

		// ---------- Utility ----------
		calcCommission(n){
			const rate = 0.20 * Math.pow(0.95, Math.max(0, Math.min(162, +n || 0)));
			return (rate * 100).toFixed(3) + "%";
		},

		esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;').replace(/"/g,'&quot;');},

		note(key, cheat){
			const docs = this.docs;
			const t = this.esc(docs[key] || "");
			return t ? (' <span class="smallLabel" style="color:'+(cheat?'#ff3705':'rgba(255,255,255,0.65)')+'">'+t+'</span>') : '';
		},

		timeBeautifier(duration, forceSeconds){
			let ms = Math.floor(duration % 1000),
				seconds = Math.floor((duration / 1000) % 60),
				minutes = Math.floor((duration / (1000 * 60)) % 60),
				hours = Math.floor((duration / (1000 * 60 * 60)) % 24),
				days = Math.floor(duration / (1000 * 60 * 60 * 24));
			if (seconds && (minutes||hours||days) && !this.stockerForceLoopUpdates) seconds = 0;
			const s = seconds + ' second' + (seconds!=1?'s':'');
			const m = minutes ? minutes + ' minute' + (minutes!=1?'s':'') + (seconds ? (hours||days ? ', and ' : ' and ') : '') : '';
			const h = hours   ? hours   + ' hour'   + (hours!=1?'s':'')   + (minutes && seconds ? ', ' : ((minutes ? !seconds : seconds) ? ' and ' : '')) : '';
			const d = days    ? days    + ' day'    + (days!=1?'s':'')    + (hours && minutes || hours && seconds || minutes && seconds ? ', ' : (((hours ? !minutes : minutes) ? !seconds : seconds) ? ' and ' : '')) : '';
			let out = d + h + m;
			if (this.stockerForceLoopUpdates && seconds) out += s;
			if (minutes||hours||days) return out;
			return s;
		},

		// ---------- CCSE menu texts ----------
		docs:{
			stockerAutoTrading:"Automatic trading when on",
			stockerMarketOn:"Stock market is running when on",
			stockerMinBrokers:"Minimum number of brokers required for automatic trading",
			stockerCookiesThreshold:"Percentage of banked cookies allowed for a single automatic trade",
			stockerAutoBuyMinimumBrokers:"Buy all necessary brokers as soon as you can afford them",
			stockerResourcesWarning:"Display warning when market conditions and/or options do not permit auto trading",
			stockerExponential:"Increases number of warehouses in sync with the highest raw CPS during this session",
			stockerExponentialPower:"Ratio exponent for Exponential Warehouses",
			stockerTransactionNotifications:"Announce transactions in game notifications",
			stockerActivityReport:"Make regular profit reports",
			stockerActivityReportFrequency:"How often to make regular reports (minutes and seconds)",
			stockerFastNotifications:"Make game notifications fade away on their own after 6 seconds",
			stockerConsoleAnnouncements:"Use console.log for more detailed info on prices and trends",
			stockerAdditionalTradingStats:"Display more detailed trading info near the top of the stock market display",
			stockerLoopFrequency:"Logic loop frequency (seconds) — CHEAT",
			stockerForceLoopUpdates:"Rolls the cycle every loop — CHEAT",
			stockerAutoBuyAdditionalBrokers:"Buy additional brokers as soon as you can afford them",
		},

		// ---------- Menu (defined now; invoked later) ----------
		getMenuString(){
			if (typeof CCSE === 'undefined' || !CCSE || !CCSE.MenuHelper) return '<div class="listing">CCSE not detected; CookiStocker menu disabled.</div>';

			const m = CCSE.MenuHelper;
			const minutes = (this.stockerActivityReportFrequency||0) / 60000;
			const loopSeconds = Math.floor((this.stockerLoopFrequency||0)/1000);
			let str = '';
			str += '<div id="csRoot">';

			// mirror
			const state = {
				stockerAutoTrading:+!!this.stockerAutoTrading,
				stockerMarketOn:+!!this.stockerMarketOn,
				stockerAutoBuyMinimumBrokers:+!!this.stockerAutoBuyMinimumBrokers,
				stockerAutoBuyAdditionalBrokers:+!!this.stockerAutoBuyAdditionalBrokers,
				stockerResourcesWarning:+!!this.stockerResourcesWarning,
				stockerExponential:+!!this.stockerExponential,
				stockerTransactionNotifications:+!!this.stockerTransactionNotifications,
				stockerActivityReport:+!!this.stockerActivityReport,
				stockerFastNotifications:+!!this.stockerFastNotifications,
				stockerConsoleAnnouncements:+!!this.stockerConsoleAnnouncements,
				stockerAdditionalTradingStats:+!!this.stockerAdditionalTradingStats,
				stockerForceLoopUpdates:+!!this.stockerForceLoopUpdates,
			};
			this.state = state;

			str += m.Header('Automation');
			str += '<div class="listing">'+m.ToggleButton(state,'stockerAutoTrading','CS_autoTrading','Auto Trading ON','Auto Trading OFF',"CookiStocker.Toggle")+this.note('stockerAutoTrading',false)+'</div>';
			str += '<div class="listing">'+m.ToggleButton(state,'stockerMarketOn','CS_market','Stock Market ON','Stock Market OFF',"CookiStocker.Toggle")+this.note('stockerMarketOn',false)+'</div>';
			str += '<div class="listing">'+m.ToggleButton(state,'stockerAutoBuyMinimumBrokers','CS_autoBuyMinimumBrokers','Auto-buy Minimum Brokers ON','Auto-buy Minimum Brokers OFF',"CookiStocker.Toggle")+this.note('stockerAutoBuyMinimumBrokers',false)+'</div>';
			str += '<div class="listing">'+m.ToggleButton(state,'stockerAutoBuyAdditionalBrokers','CS_autoBuyAdditionalBrokers','Auto-buy Additional Brokers ON','Auto-buy Additional Brokers OFF',"CookiStocker.Toggle")+this.note('stockerAutoBuyAdditionalBrokers',false)+'</div>';
			str += '<div class="listing">'+m.ToggleButton(state,'stockerResourcesWarning','CS_resourcesWarning','Resources Warning ON','Resources Warning OFF',"CookiStocker.Toggle")+this.note('stockerResourcesWarning',false)+'</div>';
			str += '<div class="listing">'+m.ToggleButton(state,'stockerExponential','CS_Exponential','Exponential Warehouses ON','Exponential Warehouses OFF',"CookiStocker.Toggle")+this.note('stockerExponential',false)+'</div>';

			let cbWarehouseExponent = "CookiStocker.stockerExponentialPower = (l('exponentSlider').value); l('exponentSliderRightText').textContent = CookiStocker.stockerExponentialPower; CookiStocker.TradingStats();";
			str += '<div class="listing">'+CCSE.MenuHelper.Slider('exponentSlider','Warehouse Exponent','<span id="exponentSliderRightText">'+this.stockerExponentialPower+'</span>',()=>this.stockerExponentialPower,cbWarehouseExponent,0.1,3.0,0.1)+' '+this.note('stockerExponentialPower',false)+'</div>';

			let cbMinBrokers = "CookiStocker.stockerMinBrokers = Math.round(l('minBrokersSlider').value); l('minBrokersSliderRightText').textContent = CookiStocker.stockerMinBrokers; l('CS_commissionVal').textContent = CookiStocker.calcCommission(CookiStocker.stockerMinBrokers); CookiStocker.TradingStats();";
			str += '<div class="listing">'+CCSE.MenuHelper.Slider('minBrokersSlider','Minimum Brokers','<span id="minBrokersSliderRightText">'+this.stockerMinBrokers+'</span>',()=>this.stockerMinBrokers,cbMinBrokers,0,162,1)+' <span class="smallLabel">(Commission: <span id="CS_commissionVal">'+this.calcCommission(this.stockerMinBrokers)+'</span>)</span> '+this.note('stockerMinBrokers',false)+'</div>';

			let stockerCookiesPercent = Math.round((this.stockerCookiesThreshold||0)*100);
			let cbCookies = "var v=Math.round(l('cookiesPercentSlider').value); CookiStocker.stockerCookiesThreshold=v/100; l('cookiesPercentSliderRightText').textContent = v + '%'; CookiStocker.TradingStats();";
			str += '<div class="listing">'+CCSE.MenuHelper.Slider('cookiesPercentSlider','Max Bank % per Purchase','<span id="cookiesPercentSliderRightText">'+stockerCookiesPercent+'%</span>',()=>stockerCookiesPercent,cbCookies,1,100,1)+' '+this.note('stockerCookiesThreshold',false)+'</div>';

			str += CCSE.MenuHelper.Header('Reporting & Notifications');
			str += '<div class="listing">'+m.ToggleButton(state,'stockerTransactionNotifications','CS_txNotifs','TX Notifications ON','TX Notifications OFF',"CookiStocker.Toggle")+this.note('stockerTransactionNotifications',false)+'</div>';
			str += '<div class="listing">'+m.ToggleButton(state,'stockerFastNotifications','CS_fastNotifs','Fast Notifications ON','Fast Notifications OFF',"CookiStocker.Toggle")+this.note('stockerFastNotifications',false)+'</div>';
			str += '<div class="listing">'+m.ToggleButton(state,'stockerConsoleAnnouncements','CS_console','Console Announce ON','Console Announce OFF',"CookiStocker.Toggle")+this.note('stockerConsoleAnnouncements',false)+'</div>';

			const _arMin=Math.floor(this.stockerActivityReportFrequency/60000);
			const _arSec=Math.floor((this.stockerActivityReportFrequency%60000)/1000);
			str += '<div class="listing"><label>Report interval:</label> '
				+ '<input id="CS_activityMin" class="smallInput" type="text" size="5" min="0" value="'+_arMin+'" style="text-align:right !important; width:3ch !important; min-width:3ch !important; max-width:3ch !important;" inputmode="numeric" oninput="CookiStocker.ChangeTime(\'stockerActivityReportFrequency\',\'CS_activityMin\',\'CS_activitySec\');"> : '
				+ '<input id="CS_activitySec" class="smallInput" type="text" size="5" min="0" max="59" value="'+_arSec+'" style="text-align:right !important; width:3ch !important; min-width:3ch !important; max-width:3ch !important;" inputmode="numeric" oninput="CookiStocker.ChangeTime(\'stockerActivityReportFrequency\',\'CS_activityMin\',\'CS_activitySec\');"> '
				+ '<span class="smallLabel">mm:ss</span></div>';

			str += '<div class="listing">'+m.ToggleButton(state,'stockerAdditionalTradingStats','CS_moreStats','Extra Trading Stats ON','Extra Trading Stats OFF',"CookiStocker.Toggle")+this.note('stockerAdditionalTradingStats',false)+'</div>';

			str += CCSE.MenuHelper.Header('Timing (Advanced)');
			str += '<div class="listing"><label>Loop (seconds): </label><input id="CS_loopFreq" type="text" size="5" value="'+loopSeconds+'" style="text-align:right !important; width:5ch !important; min-width:5ch !important; max-width:5ch !important;" inputmode="numeric" oninput="CookiStocker.ChangeNumber(\'stockerLoopFrequency\', this.value);" />'+this.note('stockerLoopFrequency',true)+'</div>';
			str += '<div class="listing">'+m.ToggleButton(state,'stockerForceLoopUpdates','CS_forceLoop','Force Loop (cheat) ON','Force Loop (cheat) OFF',"CookiStocker.Toggle")+this.note('stockerForceLoopUpdates',true)+'</div>';

			str += '</div>';
			return str;
		},

		ReplaceGameMenu(){
			if (typeof CCSE === 'undefined' || !CCSE || !CCSE.AppendCollapsibleOptionsMenu) return; // CCSE missing
			Game.customOptionsMenu.push(() => {
				const content = document.createElement('div');
				content.innerHTML = this.getMenuString();
				CCSE.AppendCollapsibleOptionsMenu(this.name, content);
			});
			Game.customStatsMenu.push(() => {
				if (!this.Bank || !this.Bank.goodsById) return;
				CCSE.AppendStatsVersionNumber(this.name, this.version);
				const p = this.Bank.profit;
				CCSE.AppendStatsGeneral('<div class="listing"><b>Stock Market has earned you :</b><div class="price plain"> $' + Beautify(p) + ' (' + Game.tinyCookie() + Beautify(p * Game.cookiesPsRawHighest) + ' cookies)</div></div>');
			});
		},

		// ---------- CCSE-dependent achievements (guarded) ----------
		ensureAchievements(){
			if (typeof CCSE === 'undefined' || !CCSE || typeof CCSE.NewAchievement !== 'function') return;
			if (Game.Achievements['Plasmic assets'] && Game.Achievements['Bose-Einstein Condensed Assets']) return;
			this.AchPlasmic = CCSE.NewAchievement(
				'Plasmic assets',
				'Have your stock market profits surpass <b>$100 million</b>.<q>This will get you charged up!</q><q>Your warehouse companies double their space.</q>',
				[10,13]
			);
			this.AchPlasmic.order = 1003100;
			this.AchBoseEinstein = CCSE.NewAchievement(
				'Bose-Einstein Condensed Assets',
				'Have your stock market profits surpass <b>$500 million</b>.<q>You have so many assets, we need to condense them!</q><q>Your warehouse companies double their space.</q>',
				[9,19]
			);
			this.AchBoseEinstein.pool = 'shadow';
			this.AchBoseEinstein.order = 1003101;
		},

		// ---------- UI helpers ----------
		buildExtraStatsHTML(){
			const S = this.stockList;
			return `
			<div class="stocker-stats">
				<span class="stat">Net cookies won: <span id="netCookies">0</span>.</span>
				<span class="stat">Cookies per hour: <span id="cookiesHour">0</span>.</span>
				<span class="stat">Cookies per day: <span id="cookiesDay">0</span>.</span>
				<span class="stat">Purchases: <span id="Purchases">0</span>.</span>
				<span class="stat">Sales: <span id="Sales">0</span>.</span>
			</div>
			<div class="stocker-stats">
				<span class="stat">CPS multiple: <span id="cpsMultiple">0</span>.</span>
				<span class="stat">Stocks held: <span id="stocksHeld">${S.totalStocks}</span>.</span>
				<span class="stat">Total shares: <span id="totalShares">${Beautify(S.totalShares, 0)}</span>.</span>
				<span class="stat">Total value: <span id="totalValue">${Beautify(S.totalValue, 2)}</span>.</span>
				<span class="stat">Unrealized profits: <span id="unrealizedProfits">${Beautify(S.unrealizedProfits, 0)}</span>.</span>
			</div>
			<div class="stocker-stats">
				<span class="stat">Profitable stocks: <span id="profitableStocks">0</span>.</span>
				<span class="stat">Unprofitable stocks: <span id="unprofitableStocks">0</span>.</span>
				<span class="stat">Profitable trades: <span id="profitableTrades">0</span>.</span>
				<span class="stat">Unprofitable trades: <span id="unprofitableTrades">0</span>.</span>
				<span class="break"></span>
				<span class="stat">Average profit per trade: <span id="averageProfit">$0</span>.</span>
				<span class="stat">Average loss per trade: <span id="averageLoss">$0</span>.</span>
			</div>`;
		},

		updateAdditionalStatsVisibility(){
			const header = l('bankHeader');
			const host = header && header.firstChild ? header.firstChild : null;
			if (!host) return;
			let extra = l(this.extraStatsId);
			if (this.stockerAdditionalTradingStats){
				if (!extra){
					extra = document.createElement('div');
					extra.id = this.extraStatsId;
					extra.innerHTML = this.buildExtraStatsHTML();
					host.appendChild(extra);
				}
				extra.style.display = '';
			} else {
				if (extra) extra.style.display = 'none';
			}
		},

		// ---------- Timers ----------
		_onMarketTick(){
			if (Game.OnAscend) return;
			if (this._tickTimeout){ clearTimeout(this._tickTimeout); this._tickTimeout = 0; }
			if (this._reportTimeout){ clearTimeout(this._reportTimeout); this._reportTimeout = 0; }

			this._tickTimeout = setTimeout(() => {
				try {
					if (typeof window.stockerLoop === 'function') window.stockerLoop();
					else if (typeof this.stockerLoop === 'function') this.stockerLoop();
				} catch(e){}
				const delay = this.stockerForceLoopUpdates ? 0 : 30000;
				this._reportTimeout = setTimeout(() => { try{ this.Reports(); }catch(e){} }, delay);
			}, 500);
		},

		installBankTickHook(){
			if (this._tickHookInstalled) return;
			const M = Game && Game.Objects && Game.Objects['Bank'] && Game.Objects['Bank'].minigame;
			if (!M || typeof M.tick !== 'function') return;
			this._tickHookInstalled = 1;
			const _orig = M.tick;
			M.tick = () => {
				const ret = _orig.apply(M, arguments);
				if (typeof this.stockerMarketOn === 'undefined' || this.stockerMarketOn){
					this._onMarketTick();
				}
				return ret;
			};
		},

		ensureReportTimer(){
			// Tear down (always clear; will recreate if needed)
			if (this.reportTimer){ clearInterval(this.reportTimer); this.reportTimer = 0; }
			const need = this.stockerMarketOn && (this.stockerActivityReport || this.stockerConsoleAnnouncements);
			if (!need){ this._reportEveryMs = 0; return; }
			const next = Math.max(1000, (+this.stockerActivityReportFrequency || 3600000));
			this._reportEveryMs = next;
			this.reportTimer = setInterval(()=>{ try{ this.Reports(); }catch(e){} }, next);
		},

		// ---------- Core loop bootstrap ----------
		launch(){
			try{
				if (Game && Game.Objects && Game.Objects['Bank'] && Game.Objects['Bank'].minigame){
					this.Bank = Game.Objects['Bank'].minigame;
					if (this._tickTimeout){ clearTimeout(this._tickTimeout); this._tickTimeout=0; }
					if (this._reportTimeout){ clearTimeout(this._reportTimeout); this._reportTimeout=0; }
					this.isLoaded = 1;
				}
			}catch(e){}
		},

		// ---------- Game hooks ----------
		init(){
			ensureStockerStyles();

			// Ascension reset hook
			Game.registerHook('reset', (hard)=>{ this.reset(hard); });

			// Wait for CCSE menu pieces safely
			(function waitCCSE(tries){
				if (typeof CCSE !== 'undefined'
					&& typeof CCSE.AppendCollapsibleOptionsMenu === 'function'
					&& typeof CCSE.AppendStatsVersionNumber === 'function'){
					try { CookiStocker.ReplaceGameMenu(); }
					catch(e){ setTimeout(()=>waitCCSE(tries-1), 250); return; }
				}else if (tries>0){
					setTimeout(()=>waitCCSE(tries-1), 250);
				}else{
					console.warn('[CookiStocker] CCSE not detected; Options/Stats menu will not be installed.');
				}
			})(120); // ~30s

			Game.Notify('CookiStocker is loaded', this.stockerGreeting, [1,33], false);

			// Kick off
			this.startStocking();
		},

		// The engine calls these directly on the registered mod object.
		save(){
			return this._serialize();
		},

		load(str){
			// Defer until Bank is ready
			let tries = 0;
			const tryLoad = () => {
				const bankReady = typeof Game==='object' && Game.ready && Game.Objects && Game.Objects['Bank'] && Game.Objects['Bank'].minigame && this.stockList.Goods.length;
				if (bankReady){
					try{
						if (!this.Bank) this.Bank = Game.Objects['Bank'].minigame;
						this._deserialize(str||'');
					}catch(e){ console.warn('[CookiStocker] load failed:', e); }
				}else{
					if (tries++ < 120) setTimeout(tryLoad, 250);
					else console.warn('[CookiStocker] load skipped (Bank minigame never became ready).');
				}
			};
			tryLoad();
		},

		startStocking(){
			// Wait for Bank minigame
			if (!(this.Bank = Game.Objects['Bank'].minigame)){
				setTimeout(()=>this.startStocking(), 500);
				return;
			}
			// Patch max stock multiplier once
			if (!this.patchedMaxStock){
				const M = this.Bank;
				const oldGet = M.getGoodMaxStock;
				M.getGoodMaxStock = (good)=>{
					const base = oldGet.call(M, good);
					// Only apply dynamic multipliers once player & profits are high enough
					const plasmic = Game.Achievements['Plasmic assets'];
					const bose   = Game.Achievements['Bose-Einstein Condensed Assets'];
					if (M.officeLevel < 3 || this.stockList.Profits < CS_PLASMIC_PROFITS) return base;

					let mult = 1;
					// release Gaseous assets from shadow the first time threshold is crossed
					if (!this.stockList.shadowGone && this.stockList.Profits >= CS_GASEOUS_PROFITS){
						const gas = Game.Achievements['Gaseous assets'];
						if (gas && gas.won){ gas.pool=''; this.stockList.shadowGone = true; }
						else return base;
					}
					if (Game.Objects['Bank'].level >= 12){
						if (this.stockerExponential && this.stockList.origCookiesPsRawHighest){
							mult *= Math.pow(Game.cookiesPsRawHighest, (this.stockerExponentialPower / this.stockList.origCookiesPsRawHighest));
						}
						if (plasmic && plasmic.won && this.stockList.Profits >= CS_PLASMIC_PROFITS * mult) mult *= 2;
						if (bose && bose.won && this.stockList.Profits >= CS_BOSE_EINSTEIN_PROFITS * mult) mult *= 2;
					}
					return Math.ceil(base * mult);
				};
				this.patchedMaxStock = true;
			}

			this.installBankTickHook();

			// Build header lines (only once)
			if (l('bankHeader') && l('bankHeader').firstChild){
				const host = l('bankHeader').firstChild;

				// Top line
				host.insertAdjacentHTML('beforeend', `
					<div class="stocker-stats">
						<span class="stat">Net profits: <span id="Profits">$0</span>.</span>
						<span class="stat">Profits per hour: <span id="profitsHour">$0</span>.</span>
						<span class="stat">Profits per day: <span id="profitsDay">$0</span>.</span>
						<span class="stat">Gross profits: <span id="grossProfits">$0</span>.</span>
						<span class="stat">Gross losses: <span id="grossLosses">$0</span>.</span>
						<span class="stat">Runtime: <span id="runTime">${this.stockerForceLoopUpdates ? "0:00:00" : "0:00"}</span></span>
					</div>
				`);
				// Warnings
				host.insertAdjacentHTML('beforeend', `
					<div class="stocker-stats" id="stockerWarnLine"  style="display:none;"><span class="stat" style="font-size:12px;color:#ff3b3b;font-weight:bold;">THERE ARE INSUFFICENT RESOURCES TO RUN AUTOMATIC TRADING. PLEASE SEE THE FOLLOWING LINE AND READ THE STEAM GUIDE.</span></div>
					<div class="stocker-stats" id="stockerWarnLine2" style="display:none;"><span class="stat" style="font-size:12px;color:#ff3b3b;font-weight:bold;">AUTO TRADING IS TURNED OFF IN THE OPTIONS.</span></div>
					<div class="stocker-stats" id="stockerWarnLine3" style="display:none;"><span class="stat" style="font-size:12px;color:#ff3b3b;font-weight:bold;">THE STOCK MARKET IS TURNED OFF IN THE OPTIONS.</span></div>
				`);
				// Brokers/bank line
				host.insertAdjacentHTML('beforeend', `
					<div class="stocker-stats">
						<span class="stat">Brokers: <span id="Brokers">0</span>.</span>
						<span class="stat">Brokers Needed: <span id="brokersNeeded">0</span>.</span>
						<span class="stat">Banked cookies: <span id="bankedCookies">0</span>.</span>
						<span class="stat">Required cookie minimum: <span id="minCookies">0</span>.</span>
						<span class="stat">Maximum: <span id="maxCookies">0</span>.</span>
					</div>
				`);
				// Optional extra block container
				let extra = l(this.extraStatsId);
				if (!extra){
					extra = document.createElement('div');
					extra.id = this.extraStatsId;
					host.appendChild(extra);
				}
				if (this.stockerAdditionalTradingStats){
					extra.innerHTML = this.buildExtraStatsHTML();
					extra.style.display = '';
				}else{
					extra.innerHTML = '';
					extra.style.display = 'none';
				}
			}

			// Read market snapshot and prep arrays
			const market = this.Bank.goodsById;
			this.stockList.startingProfits = this.Bank.profit;
			if (!this.stockList.Goods.length){
				for (let i=0;i<market.length;i++){
					this.stockList.Goods.push({
						name: market[i].name,
						stock: market[i].stock,
						currentPrice: market[i].val,
						mode: market[i].mode,
						lastMode: market[i].mode,
						lastDur: market[i].dur,
						unchangedDur: 0,
						dropCount: 0,
						riseCount: 0,
						profit: 0,
						someSold: false,
						someBought: false,
					});
				}
			}
			this.ensureAchievements();
			this.ensureReportTimer();
			this.TradingStats();

			// restart main loop cleanly
			if (this.LoopHandle){ clearInterval(this.LoopHandle); this.LoopHandle=0; }
			this.LoopHandle = setInterval(()=>this._logicLoop(), this.stockerLoopFrequency);
		},

		_logicLoop(){
			// skip during ascension/transition or if UI not ready yet
			if (Game.OnAscend || (typeof Game.AscendTimer !== 'undefined' && Game.AscendTimer > 0) || l("Brokers")==null) return;

			const M = this.Bank;
			const S = this.stockList;

			if (this.stockerMarketOn){
				if (S.noModActions){ S.noModActions = false; this.TradingStats(); }
				M.secondsPerTick = this.stockerForceLoopUpdates ? Math.max(0.001, this.stockerLoopFrequency/1000) : 60;
			}else{
				if (S.noModActions) return;
				M.secondsPerTick = CS_TEN_YEARS;
			}

			// reflect tick period back into loop frequency (when not forcing)
			if (!this.stockerForceLoopUpdates && this.stockerMarketOn){
				this.stockerLoopFrequency = M.secondsPerTick * 500; // stay aligned
			}

			// Achievement grants (null-safe)
			const achP = Game.Achievements['Plasmic assets'];
			const achB = Game.Achievements['Bose-Einstein Condensed Assets'];
			if (M.profit >= 100000000 && achP && !achP.won) Game.Win('Plasmic assets');
			if (M.profit >= 500000000 && achB && !achB.won) Game.Win('Bose-Einstein Condensed Assets');

			let amountActive = 0;
			let market = M.goodsById;

			// Autobuy brokers if enabled
			if (!Game.OnAscend && (this.stockerAutoBuyMinimumBrokers || this.stockerAutoBuyAdditionalBrokers)){
				let buyBrokers = this.stockerMinBrokers - M.brokers;
				let changed = false;
				if (this.stockerAutoBuyMinimumBrokers && buyBrokers>0 && this.stockerMinBrokers <= M.getMaxBrokers() && buyBrokers * M.getBrokerPrice() < Game.cookies * 0.1){
					Game.Spend(M.getBrokerPrice()*buyBrokers);
					M.brokers = this.stockerMinBrokers;
					changed = true;
				}
				let buyMore = M.getMaxBrokers() - M.brokers;
				let cost = buyMore * M.getBrokerPrice();
				if (this.stockerAutoBuyAdditionalBrokers && buyMore>0 && cost < Game.cookies * 0.1){
					Game.Spend(cost);
					M.brokers += buyMore;
					changed = true;
				}
				if (changed) this.TradingStats();
			}

			S.canBuy = this.stockerAutoTrading && M.brokers >= this.stockerMinBrokers;

			// Prevent runaway when bank cannot afford any complete purchase
			for (let i=0;i<market.length;i++){
				if (S.canBuy && !((M.getGoodMaxStock(market[i]) - market[i].stock) * Game.cookiesPsRawHighest * market[i].val < Game.cookies * this.stockerCookiesThreshold)){
					// schedule a stats update anchored on tick boundary
					let now = Date.now(); let remainder;
					S.Start += now - S.lastTime;
					S.Uptime = Math.floor((now - S.Start)/1000)*1000;
					if ( (remainder = S.Uptime % this.stockerLoopFrequency) ){
						S.Start += M.secondsPerTick*1000 + remainder;
						S.Uptime -= M.secondsPerTick*1000 + remainder;
					}
					S.lastTime = now;
					this.TradingStats();
					S.canBuy = false;
					if (!this.stockerAutoTrading){
						S.noModActions = true;
						if (this.reportTimer){ clearInterval(this.reportTimer); this.reportTimer=0; }
					}
				}
				amountActive += Game.ObjectsById[i+2].amount;
			}
			if (!(S.Amount = amountActive)) return;

			this.TradingStats();
			this.ensureReportTimer();

			if (S.canBuy && !S.origCookiesPsRawHighest) S.origCookiesPsRawHighest = Game.cookiesPsRawHighest;

			// trade logic
			for (let i=0;i<market.length;i++){
				const g = market[i];
				const rec = S.Goods[i];

				const lastPrice = rec.currentPrice;
				const currentPrice = g.val;

				// update snapshot
				rec.stock = g.stock;
				rec.currentPrice = g.val;
				rec.mode = g.mode;

				let md = rec.mode;
				let lmd = rec.lastMode;
				let lastStock = g.stock;

				const smallDelta = 3;
				const largeDelta = 4;
				const alwaysBuyBelow = 2;
				const neverSellBelow = 11;

				let deltaPrice = largeDelta;
				const stockName = g.name.replace('%1', Game.bakeryName);
				const ceilingPrice = Math.max(10*(i+1) + Game.Objects['Bank'].level + 49, 97 + Game.Objects['Bank'].level * 3);

				// detect new tick change
				let doUpdate = false;
				if (rec.lastDur != g.dur || ++rec.unchangedDur > 1){ rec.unchangedDur = 0; doUpdate = true; }

				// trend counters
				if (md!=lmd && ((md==3 && lmd!=1) || (md==4 && lmd!=2) || (md==1 && lmd!=3) || (md==2 && lmd!=4))){
					rec.dropCount = 0; rec.riseCount = 0;
				}else if (currentPrice > lastPrice){ rec.dropCount = 0; rec.riseCount++; }
				else if (currentPrice < lastPrice){ rec.riseCount = 0; rec.dropCount++; }

				if (lmd==md && (rec.stock && (md==2||md==4) || !rec.stock && (md==1||md==3))) deltaPrice = smallDelta;

				rec.lastDur = g.dur;

				// BUY
				if (
					(
						currentPrice < alwaysBuyBelow ||
						(md != 4 && (
							(currentPrice > lastPrice && rec.riseCount >= deltaPrice) ||
							((md==1||md==3) && md!=lmd) ||
							(md==0 && !rec.someSold && rec.dropCount < deltaPrice && currentPrice >= 10)
						) && (currentPrice < ceilingPrice || md==1 || md==3))
					)
					&& S.canBuy
					&& ((M.getGoodMaxStock(g) - g.stock) * Game.cookiesPsRawHighest * g.val < Game.cookies * this.stockerCookiesThreshold && M.brokers >= this.stockerMinBrokers)
					&& M.buyGood(i,10000)
				){
					// record
					const units = g.stock - lastStock;
					rec.someBought = true;
					rec.stock = g.stock;
					g.buyTime = Date.now();
					if (typeof window.StockAssistant!=='undefined'){
						window.StockAssistant.stockData.goods[i].boughtVal = g.prev;
						window.StockAssistant.buyGood(i);
					}
					S.Purchases++;
					if (this.stockerTransactionNotifications){
						const t = new Date().toLocaleTimeString([], {hourCycle:'h23',hour:'2-digit',minute:'2-digit'});
						if (currentPrice >= 2) Game.Notify(`Buying ${stockName} ${t}`,`Buying ${units} unit${(units>1?'s':'')}. Price $${Beautify(g.prev,2)}. Mode ${modeDecoder[md]}.`,goodIcons[i], this.stockerFastNotifications*6);
						else Game.Notify(`Buying ${stockName} ${t}`,`Buying ${units} unit${(units>1?'s':'')}. Price fell below $2; your buy price is $${Beautify(g.prev,2)}.`,goodIcons[i], this.stockerFastNotifications*6);
					}
				}
				// SELL
				else if (
					rec.stock > 0 &&
					((currentPrice < lastPrice && rec.dropCount >= deltaPrice) || ((md==2||md==4) && md!=lmd))
					&& currentPrice >= neverSellBelow
				){
					let profit = 0;
					if (!M.sellGood(i, rec.stock)){ rec.lastMode = rec.mode; continue; }
					rec.someSold = true;
					g.prevSale = g.val;
					g.prevSellMode1 = lmd; g.prevSellMode2 = md; g.sellTime = Date.now();
					if (typeof window.StockAssistant!=='undefined') window.StockAssistant.sellGood(i);
					S.Sales++;
					profit = (g.val - g.prev) * rec.stock;
					rec.profit += profit;
					if (profit > 0){ S.grossProfits += profit; S.profitableTrades++; }
					else { S.grossLosses += -profit; S.unprofitableTrades++; }
					S.netProfits += profit;
					this.stockerModeProfits[lmd][md][0] += profit;
					this.stockerModeProfits[lmd][md][1] += profit;
					this.stockerModeProfits[lmd][md][2]++;

					if (this.stockerTransactionNotifications){
						const t = new Date().toLocaleTimeString([], {hourCycle:'h23',hour:'2-digit',minute:'2-digit'});
						const strProfit = profit >= 0 ? 'profit' : 'loss';
						const shown = profit>=0 ? profit : -profit;
						Game.Notify(`Selling ${stockName} ${t}`,`Selling ${rec.stock} unit${(rec.stock>1?'s':'')} at $${Beautify(g.val,2)} for a ${strProfit} of $${Beautify(shown,2)} (bought at $${Beautify(g.prev,2)}).`,goodIcons[i], this.stockerFastNotifications*6);
					}
				}

				S.Profits = M.profit - S.startingProfits;
				rec.lastMode = rec.mode;
			}

			// recompute profitable/unprofitable counts
			S.profitableStocks = S.unprofitableStocks = 0;
			for (let i=0;i<market.length;i++){
				if (S.Goods[i].profit > 0) S.profitableStocks++;
				else if (S.Goods[i].profit < 0) S.unprofitableStocks++;
			}
			this.TradingStats();

			if (!this.stockerMarketOn){
				if (this.reportTimer){ clearInterval(this.reportTimer); this.reportTimer=0; }
				this.Reports();
				S.noModActions = true;
				return;
			}
		},

		Reports(){
			const S = this.stockList;
			if (l("Brokers")==null || !S.Amount || !S.canBuy) return;
			this.TradingStats();
			if (S.noModActions || (!this.stockerActivityReport && !this.stockerConsoleAnnouncements)) return;

			const notifTime = this.stockerFastNotifications*6;

			if (this.stockerActivityReport){
				if ((S.Purchases + S.Sales) == 0){
					Game.Notify(`CookiStocker report ${new Date().toLocaleTimeString([], {hourCycle:'h23',hour:'2-digit',minute:'2-digit'})}`,
						`This session has been running for ${this.timeBeautifier(S.Uptime)}, but no good investment opportunities were detected!`,
						[1,33], notifTime);
				}else{
					Game.Notify(`CookiStocker report ${new Date().toLocaleTimeString([], {hourCycle:'h23',hour:'2-digit',minute:'2-digit'})}`,
						`Running for ${this.timeBeautifier(S.Uptime)}; net $${Beautify(S.netProfits,0)}; displayed $${Beautify(S.Profits,0)}; ${Beautify(S.Purchases,0)} buys & ${Beautify(S.Sales,0)} sells.`,
						[1,33], notifTime);
				}
			}

			if (this.stockerConsoleAnnouncements){
				let totalProfits = 0, deltaTotalProfits = 0, totalTrades = 0;
				for (let j=0;j<6;j++) for (let k=0;k<6;k++){
					totalProfits += this.stockerModeProfits[j][k][0];
				}
				for (let j=0;j<6;j++) for (let k=0;k<6;k++){
					deltaTotalProfits += this.stockerModeProfits[j][k][1];
					totalTrades += this.stockerModeProfits[j][k][2];
				}
				S.hourlyProfits = totalProfits * (this.stockerLoopFrequency/60000) * 3600000 / (S.Uptime+1);
				S.dailyProfits  = totalProfits * (this.stockerLoopFrequency/60000) * 86400000 / (S.Uptime+1);
				if (!this.stockerForceLoopUpdates){ S.hourlyProfits *= 2; S.dailyProfits *= 2; }
				console.log(`[CookiStocker] Total profits=$${Beautify(totalProfits,2)} Δ=$${Beautify(deltaTotalProfits,2)} trades=${totalTrades}`);
				console.log(`[CookiStocker] $/hr=${Beautify(S.hourlyProfits,2)} $/day=${Beautify(S.dailyProfits,2)}`);
				// zero out per-period deltas
				for (let j=0;j<6;j++) for (let k=0;k<6;k++) this.stockerModeProfits[j][k][1]=0;
			}
		},

		// Small helper to paint numbers with colors/warnings
		DataStats(id, value, dollars){
			const it = l(id); if (!it) return;
			it.innerHTML = (value<0?"-":"") + (dollars?'$':'') + Beautify(Math.abs(value), 0);
			// special coloring
			if (id === "Brokers" && this.Bank && this.Bank.brokers < this.stockerMinBrokers) value = -1;
			else if (id === "bankedCookies"){
				if (Game.cookies > this.stockList.minCookies && Game.cookies < this.stockList.maxCookies){
					it.classList.remove("green"); it.style.color='yellow'; return;
				}else if (Game.cookies < this.stockList.minCookies) value = -1;
			}
			if (value > 0){ it.classList.add("green"); it.style.color=''; }
			else if (value < 0){ it.classList.remove("green"); it.classList.remove("yellow"); it.style.color='#ff3b3b'; }
		},

		TradingStats(){
			if (!this.Bank) return;
			const S = this.stockList;
			const market = this.Bank.goodsById;
			const now = Date.now();

			// sleeping catchup
			if (now > S.lastTime + this.stockerActivityReportFrequency + 500){
				S.Start += now - S.lastTime - this.stockerActivityReportFrequency;
			}

			S.totalStocks = 0; S.totalShares = 0; S.totalValue = 0; S.unrealizedProfits = 0;
			for (let i=0;i<market.length;i++){
				if (S.Goods[i] && S.Goods[i].stock){
					S.totalStocks++;
					S.totalShares += S.Goods[i].stock;
					S.totalValue  += S.Goods[i].stock * S.Goods[i].currentPrice;
					S.unrealizedProfits += (market[i].val - market[i].prev) * S.Goods[i].stock;
				}
			}

			S.minCookies = Number.MAX_VALUE; S.maxCookies = 0;
			for (let i=0;i<market.length;i++){
				const shares = this.Bank.getGoodMaxStock(market[i]) - market[i].stock;
				const cookies = shares * Game.cookiesPsRawHighest * market[i].val / this.stockerCookiesThreshold;
				if (!S.minCookies || (shares && cookies < S.minCookies)) S.minCookies = cookies;
				if (shares && cookies > S.maxCookies) S.maxCookies = cookies;
			}

			this.DataStats("Brokers", this.Bank.brokers, 0);
			this.DataStats("brokersNeeded", this.stockerMinBrokers, 0);
			this.DataStats("bankedCookies", Game.cookies, 0);
			this.DataStats("minCookies", S.minCookies, 0);
			this.DataStats("maxCookies", S.maxCookies, 0);
			this.DataStats("Profits", S.netProfits, 1);
			this.DataStats("profitsHour", S.hourlyProfits, 1);
			this.DataStats("profitsDay", S.dailyProfits, 1);
			this.DataStats("grossProfits", S.grossProfits, 1);
			this.DataStats("grossLosses", -S.grossLosses, 1);

			S.lastTime = now;
			S.Uptime = Math.floor((now - S.Start)/1000)*1000;
			S.Uptime -= S.Uptime % this.stockerLoopFrequency;

			let uptimeHours = Math.floor(S.Uptime/3600000);
			let uptimeDays = Math.floor(uptimeHours/24);
			if (uptimeDays>=1){ uptimeDays+=':'; uptimeHours%=24; if (uptimeHours<10) uptimeHours='0'+uptimeHours; }
			else uptimeDays='';

			const it = l("runTime");
			if (it){
				it.innerHTML = uptimeDays + uptimeHours + ':';
				if (this.stockerForceLoopUpdates){
					it.innerHTML += new Date(S.Uptime).toLocaleTimeString([], {minute:'2-digit', second:'2-digit'});
				}else{
					const uptimeMinutes = (Math.floor(S.Uptime/60000))%60;
					it.innerHTML += (uptimeMinutes<10?'0':'') + uptimeMinutes;
				}
				if (it.innerHTML==='') it.innerHTML = "0:00";
			}

			if (this.stockerAdditionalTradingStats){
				this.DataStats("netCookies", S.netProfits * Game.cookiesPsRawHighest, 0);
				this.DataStats("cookiesHour", S.hourlyProfits * Game.cookiesPsRawHighest, 0);
				this.DataStats("cookiesDay", S.dailyProfits * Game.cookiesPsRawHighest, 0);
				if (l("Purchases")) l("Purchases").innerHTML = S.Purchases;
				if (l("Sales")) l("Sales").innerHTML = S.Sales;
				if (l("cpsMultiple")) l("cpsMultiple").innerHTML = S.hourlyProfits>=0 ? Beautify(S.hourlyProfits/3600,3) : -Beautify(-S.hourlyProfits/3600,3);
				if (l("stocksHeld")) l("stocksHeld").innerHTML = S.totalStocks;
				if (l("totalShares")) l("totalShares").innerHTML = Beautify(S.totalShares);
				this.DataStats("totalValue", S.totalValue, 1);
				this.DataStats("unrealizedProfits", S.unrealizedProfits, 1);
				if (l("profitableStocks")) l("profitableStocks").innerHTML = S.profitableStocks;
				if (l("unprofitableStocks")) l("unprofitableStocks").innerHTML = S.unprofitableStocks;
				if (l("profitableTrades")) l("profitableTrades").innerHTML = S.profitableTrades;
				if (l("unprofitableTrades")) l("unprofitableTrades").innerHTML = S.unprofitableTrades;
				this.DataStats("averageProfit", S.profitableTrades ? S.grossProfits/S.profitableTrades : 0, 1);
				this.DataStats("averageLoss",   S.unprofitableTrades ? -S.grossLosses/S.unprofitableTrades : 0, 1);
			}

			this.updateWarn();
		},

		updateWarn(){
			const warn  = l('stockerWarnLine');
			const warn2 = l('stockerWarnLine2');
			const warn3 = l('stockerWarnLine3');

			if (warn)  warn.style.display = 'none';
			if (warn2) warn2.style.display = 'none';
			if (warn3) warn3.style.display = 'none';

			if (!this.stockerResourcesWarning) return;

			if (warn3 && !this.stockerMarketOn){ warn3.style.display=''; return; }
			if (warn2 && !this.stockerAutoTrading){ warn2.style.display=''; return; }

			if (!warn) return;

			// insufficient if short on brokers OR short on banked cookies for a full lot anywhere
			if (this.Bank.brokers < this.stockerMinBrokers){ warn.style.display=''; return; }
			const market = this.Bank.goodsById;
			for (let i=0;i<market.length;i++){
				if ((this.Bank.getGoodMaxStock(market[i])-market[i].stock) * Game.cookiesPsRawHighest * market[i].val >= Game.cookies * this.stockerCookiesThreshold){
					warn.style.display='';
					return;
				}
			}
			warn.style.display='none';
		},

		// ---------- menu toggle + inputs ----------
		state:{},
		Toggle(prefName, button, on, off, invert){
			this.state[prefName] = this.state[prefName] ? 0 : 1;
			const el = l(button); if (el){ el.innerHTML = this.state[prefName] ? on : off; el.className = 'smallFancyButton prefButton option'+((this.state[prefName]^invert)?'':' off'); }
			switch (prefName){
				case 'stockerAutoTrading': this.stockerAutoTrading = !!this.state[prefName]; this.updateWarn(); break;
				case 'stockerMarketOn': this.stockerMarketOn = !!this.state[prefName]; this.updateWarn(); this.ensureReportTimer(); break;
				case 'stockerAutoBuyMinimumBrokers': this.stockerAutoBuyMinimumBrokers = !!this.state[prefName]; this.TradingStats(); break;
				case 'stockerAutoBuyAdditionalBrokers': this.stockerAutoBuyAdditionalBrokers = !!this.state[prefName]; this.TradingStats(); break;
				case 'stockerResourcesWarning': this.stockerResourcesWarning = !!this.state[prefName]; this.updateWarn(); break;
				case 'stockerExponential': this.stockerExponential = !!this.state[prefName]; break;
				case 'stockerTransactionNotifications': this.stockerTransactionNotifications = !!this.state[prefName]; break;
				case 'stockerActivityReport': this.stockerActivityReport = !!this.state[prefName]; this.ensureReportTimer(); break;
				case 'stockerFastNotifications': this.stockerFastNotifications = !!this.state[prefName]; break;
				case 'stockerConsoleAnnouncements': this.stockerConsoleAnnouncements = !!this.state[prefName]; this.ensureReportTimer(); break;
				case 'stockerAdditionalTradingStats': this.stockerAdditionalTradingStats = !!this.state[prefName]; this.updateAdditionalStatsVisibility(); break;
				case 'stockerForceLoopUpdates': this.stockerForceLoopUpdates = !!this.state[prefName]; break;
			}
			PlaySound('snd/tick.mp3');
			Game.UpdateMenu();
		},

		ChangeTime(prefName, minId, secId){
			let mins = Math.max(0, Math.floor(+l(minId).value || 0));
			let secs = Math.max(0, Math.min(59, Math.floor(+l(secId).value || 0)));
			let ms = (mins*60 + secs) * 1000;
			switch (prefName){
				case 'stockerActivityReportFrequency':
					this.stockerActivityReportFrequency = ms; this.ensureReportTimer(); break;
				case 'stockerLoopFrequency':
					this.stockerLoopFrequency = ms;
					if (this.stockerForceLoopUpdates && this.Bank && this.Bank.secondsPerTick){
						this.Bank.secondsPerTick = Math.max(0.001, this.stockerLoopFrequency/1000);
					}
					break;
			}
			PlaySound('snd/tick.mp3');
		},

		ChangeNumber(prefName, val){
			let v = Math.max(0, Math.floor(+val || 0));
			switch (prefName){
				case 'stockerMinBrokers': this.stockerMinBrokers = v; break;
				case 'stockerActivityReportFrequency': this.stockerActivityReportFrequency = v; this.ensureReportTimer(); break;
				case 'stockerLoopFrequency':
					this.stockerLoopFrequency = v;
					if (this.stockerForceLoopUpdates && this.Bank && this.Bank.secondsPerTick){
						this.Bank.secondsPerTick = Math.max(0.001, this.stockerLoopFrequency/1000);
					}
					break;
			}
			PlaySound('snd/tick.mp3');
		},

		// ---------- Serialization ----------
		_serialize(){
			if (!this.Bank) return '';
			const S = this.stockList;
			const market = this.Bank.goodsById;
			let str = ''+Number(S.Check);
			for (let i=0;i<market.length;i++){
				const G = S.Goods[i] || {};
				str += '_' + encodeURIComponent(G.name||market[i].name||'');
				str += '_' + Number(G.stock||0);
				str += '_' + Number(market[i].val||0);
				str += '_' + Number(G.currentPrice||0);
				str += '_' + Number(G.mode||0);
				str += '_' + Number(G.lastMode||0);
				str += '_' + Number(G.lastDur||0);
				str += '_' + Number(G.unchangedDur||0);
				str += '_' + Number(G.dropCount||0);
				str += '_' + Number(G.riseCount||0);
				str += '_' + Number(G.profit||0);
				str += '_' + (+!!G.someSold);
				str += '_' + (+!!G.someBought);
			}
			str += '_' + Number(S.Start);
			str += '_' + Number(S.lastTime);
			str += '_' + Number(S.startingProfits);
			str += '_' + Number(S.Profits);
			str += '_' + Number(S.netProfits);
			str += '_' + Number(S.grossProfits);
			str += '_' + Number(S.grossLosses);
			str += '_' + Number(S.totalStocks);
			str += '_' + Number(S.totalShares);
			str += '_' + Number(S.totalValue);
			str += '_' + Number(S.unrealizedProfits);
			str += '_' + Number(S.profitableStocks);
			str += '_' + Number(S.unprofitableStocks);
			str += '_' + Number(S.profitableTrades);
			str += '_' + Number(S.unprofitableTrades);
			str += '_' + Number(S.Purchases);
			str += '_' + Number(S.Sales);
			str += '_' + Number(S.Uptime);
			str += '_' + Number(S.hourlyProfits);
			str += '_' + Number(S.dailyProfits);
			str += '_' + Number(S.minCookies);
			str += '_' + Number(S.maxCookies);
			str += '_' + (+!!S.noModActions);
			str += '_' + Number(S.origCookiesPsRawHighest);
			for (let i=0;i<6;i++) for (let j=0;j<6;j++) for (let k=0;k<3;k++) str += '_' + Number(this.stockerModeProfits[i][j][k]);
			// Achievements snapshot (null-safe 0/1)
			const P = Game.Achievements['Plasmic assets'];
			const B = Game.Achievements['Bose-Einstein Condensed Assets'];
			str += '_' + (P && P.won ? 1 : 0);
			str += '_' + (B && B.won ? 1 : 0);

			// options tail
			const cfg = {
				stockerAutoTrading:this.stockerAutoTrading,
				stockerMinBrokers:this.stockerMinBrokers,
				stockerAutoBuyMinimumBrokers:this.stockerAutoBuyMinimumBrokers,
				stockerTransactionNotifications:this.stockerTransactionNotifications,
				stockerActivityReport:this.stockerActivityReport,
				stockerActivityReportFrequency:this.stockerActivityReportFrequency,
				stockerFastNotifications:this.stockerFastNotifications,
				stockerConsoleAnnouncements:this.stockerConsoleAnnouncements,
				stockerAdditionalTradingStats:this.stockerAdditionalTradingStats,
				stockerLoopFrequency:this.stockerLoopFrequency,
				stockerForceLoopUpdates:this.stockerForceLoopUpdates,
				stockerCookiesThreshold:this.stockerCookiesThreshold,
				stockerResourcesWarning:this.stockerResourcesWarning,
				stockerMarketOn:this.stockerMarketOn,
				stockerExponential:this.stockerExponential,
				stockerExponentialPower:this.stockerExponentialPower,
				stockerAutoBuyAdditionalBrokers:this.stockerAutoBuyAdditionalBrokers,
			};
			str += '|CFG:' + JSON.stringify(cfg);
			return str;
		},

		_deserialize(str){
			if (!this.Bank || !str) return false;
			let cfg = null;
			const idx = str.indexOf('|CFG:');
			if (idx>-1){
				try{ cfg = JSON.parse(str.slice(idx+5)); }catch(e){ cfg=null; }
				str = str.slice(0, idx);
			}
			let i=0, j,k,m;
			const S = this.stockList;
			const market = this.Bank.goodsById;

			let spl = str.split('_');
			S.Check = Number(spl[i++]||0);

			// Goods
			if (!S.Goods.length){
				for (let g=0; g<market.length; g++){
					S.Goods.push({name:market[g].name,stock:0,currentPrice:market[g].val,mode:market[g].mode,lastMode:market[g].mode,lastDur:market[g].dur,unchangedDur:0,dropCount:0,riseCount:0,profit:0,someSold:false,someBought:false});
				}
			}
			for (j=0;j<market.length;j++){
				const tok = (spl[i++]||''); let nm;
				try{ nm = decodeURIComponent(tok); }catch(e){ nm = tok; }
				if (!nm || nm==='NaN') nm = market[j].name;
				S.Goods[j].name = nm;

				S.Goods[j].stock = Number(spl[i++]||0);
				S.Goods[j].val = Number(spl[i++]||0);
				S.Goods[j].currentPrice = Number(spl[i++]||0);
				S.Goods[j].mode = Number(spl[i++]||0);
				S.Goods[j].lastMode = Number(spl[i++]||0);
				S.Goods[j].lastDur = Number(spl[i++]||0);
				S.Goods[j].unchangedDur = Number(spl[i++]||0);
				S.Goods[j].dropCount = Number(spl[i++]||0);
				S.Goods[j].riseCount = Number(spl[i++]||0);
				S.Goods[j].profit = Number(spl[i++]||0);
				S.Goods[j].someSold = !!(+spl[i++]||0);
				S.Goods[j].someBought = !!(+spl[i++]||0);
			}

			S.Start = Number(spl[i++]||0);
			S.lastTime = Number(spl[i++]||0);
			S.startingProfits = Number(spl[i++]||0);
			S.Profits = Number(spl[i++]||0);
			S.netProfits = Number(spl[i++]||0);
			S.grossProfits = Number(spl[i++]||0);
			S.grossLosses = Number(spl[i++]||0);
			S.totalStocks = Number(spl[i++]||0);
			S.totalShares = Number(spl[i++]||0);
			S.totalValue = Number(spl[i++]||0);
			S.unrealizedProfits = Number(spl[i++]||0);
			S.profitableStocks = Number(spl[i++]||0);
			S.unprofitableStocks = Number(spl[i++]||0);
			S.profitableTrades = Number(spl[i++]||0);
			S.unprofitableTrades = Number(spl[i++]||0);
			S.Purchases = Number(spl[i++]||0);
			S.Sales = Number(spl[i++]||0);
			S.Uptime = Number(spl[i++]||0);
			S.hourlyProfits = Number(spl[i++]||0);
			S.dailyProfits = Number(spl[i++]||0);

			// Tail (new)
			S.minCookies = Number(spl[i++]||0);
			S.maxCookies = Number(spl[i++]||0);
			S.noModActions = !!(+spl[i++]||0);
			S.origCookiesPsRawHighest = Number(spl[i++]||0);

			for (j=0;j<6;j++) for (k=0;k<6;k++) for (m=0;m<3;m++) this.stockerModeProfits[j][k][m] = Number(spl[i++]||0);

			// Achievements snapshot (null-safe set)
			let t = +spl[i++]; if (Game.Achievements['Plasmic assets']) Game.Achievements['Plasmic assets'].won = (t===1?1:0);
			t = +spl[i++];     if (Game.Achievements['Bose-Einstein Condensed Assets']) Game.Achievements['Bose-Einstein Condensed Assets'].won = (t===1?1:0);

			// Apply cfg
			if (cfg){
				this.stockerAutoTrading = !!cfg.stockerAutoTrading;
				this.stockerMarketOn = !!cfg.stockerMarketOn;
				this.stockerMinBrokers = +cfg.stockerMinBrokers | 0;
				this.stockerCookiesThreshold = Math.min(1, Math.max(0.000001, +cfg.stockerCookiesThreshold || 0.05));
				this.stockerAutoBuyMinimumBrokers = !!cfg.stockerAutoBuyMinimumBrokers;
				this.stockerAutoBuyAdditionalBrokers = !!cfg.stockerAutoBuyAdditionalBrokers;
				this.stockerResourcesWarning = !!cfg.stockerResourcesWarning;
				this.stockerExponential = !!cfg.stockerExponential;
				this.stockerExponentialPower = +cfg.stockerExponentialPower || 1.0;
				this.stockerTransactionNotifications = !!cfg.stockerTransactionNotifications;
				this.stockerActivityReport = !!cfg.stockerActivityReport;
				this.stockerActivityReportFrequency = +cfg.stockerActivityReportFrequency || 60000;
				this.stockerFastNotifications = !!cfg.stockerFastNotifications;
				this.stockerConsoleAnnouncements = !!cfg.stockerConsoleAnnouncements;
				this.stockerAdditionalTradingStats = !!cfg.stockerAdditionalTradingStats;
				this.stockerLoopFrequency = +cfg.stockerLoopFrequency || 30000;
				this.stockerForceLoopUpdates = !!cfg.stockerForceLoopUpdates;
			}

			// normalize
			if (!(this.stockerLoopFrequency>0)) this.stockerLoopFrequency=30000;
			if (this.stockerLoopFrequency<1000) this.stockerLoopFrequency=1000;
			if (!(this.stockerActivityReportFrequency>0)) this.stockerActivityReportFrequency=60000;
			if (this.stockerActivityReportFrequency<1000) this.stockerActivityReportFrequency=1000;
			if (this.stockerMinBrokers<0) this.stockerMinBrokers=0;
			if (this.stockerMinBrokers>162) this.stockerMinBrokers=162;

			this.ensureReportTimer();
			this.updateAdditionalStatsVisibility();
			if (l('bankHeader')) this.TradingStats();
			return true;
		},

		reset(hard){
			if (!this.Bank) return;
			// stop loop
			if (this.LoopHandle){ clearInterval(this.LoopHandle); this.LoopHandle=0; }
			if (this._tickTimeout){ clearTimeout(this._tickTimeout); this._tickTimeout=0; }
			if (this._reportTimeout){ clearTimeout(this._reportTimeout); this._reportTimeout=0; }

			const market = this.Bank.goodsById;
			this.stockList.Goods = [];
			for (let i=0;i<market.length;i++){
				this.stockList.Goods.push({
					name: market[i].name, stock: market[i].stock, currentPrice: market[i].val,
					mode: market[i].mode, lastMode: market[i].mode, lastDur: market[i].dur,
					unchangedDur: 0, dropCount: 0, riseCount: 0, profit: 0, someSold:false, someBought:false
				});
			}
			const S = this.stockList;
			S.Start = Date.now()+500;
			S.lastTime = Date.now()+500;
			S.startingProfits = 0;
			S.Profits=0; S.netProfits=0; S.grossProfits=0; S.grossLosses=0;
			S.totalStocks=0; S.totalShares=0; S.totalValue=0; S.unrealizedProfits=0;
			S.profitableStocks=0; S.unprofitableStocks=0; S.profitableTrades=0; S.unprofitableTrades=0;
			S.Purchases=0; S.Sales=0; S.Uptime=0; S.hourlyProfits=0; S.dailyProfits=0;
			S.minCookies=Number.MAX_VALUE; S.maxCookies=0; S.noModActions=true; S.Amount=0;
			for (let i=0;i<6;i++) for (let j=0;j<6;j++) for (let k=0;k<3;k++) this.stockerModeProfits[i][j][k]=0;

			if (hard){
				this.stockerMarketOn = true;
				S.origCookiesPsRawHighest = 0;
				const P = Game.Achievements['Plasmic assets']; if (P) P.won=0;
				const B = Game.Achievements['Bose-Einstein Condensed Assets']; if (B) B.won=0;
			}
		},
	};

	// expose for CCSE helpers
	window.CookiStocker = CookiStocker;

	// Register the mod using the fully-defined object (prevents early-call issues)
	Game.registerMod('CookiStocker', CookiStocker);
})();
