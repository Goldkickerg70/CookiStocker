//////////////////////////////
// ----- USER OPTIONS -----
//////////////////////////////

// Automatic trading when true
var stockerAutoTrading = true;

// Stock market is running when true
var stockerMarketOn = true;

// Minimum number of brokers required for automatic trading
var stockerMinBrokers = 72; // ~0.5% commission

// Fraction of banked cookies allowed for automatic trading (per purchase)
var stockerCookiesThreshold = 0.05;

// Buy all necessary brokers as soon as we can afford them
var stockerAutoBuyMinimumBrokers = true;

// Buy additional brokers as soon as we can afford them
var stockerAutoBuyAdditionalBrokers = true;

// Increases number of warehouses in sync with the highest raw CPS during this session
var stockerExponential = true;

// The ratio of the highest raw CPS to the original raw CPS is raised to this power when Exponential Warehouses is on
var stockerExponentialPower = 1.0;

// Announce transactions in game notifications
var stockerTransactionNotifications = true;

// Make regular profit reports
var stockerActivityReport = false;
// How often to make regular reports in ms (one hour by default)
var stockerActivityReportFrequency = 1000 * 60 * 60;

// Make game notifications fade away on their own (6s)
var stockerFastNotifications = false;

// Use console.log for more detailed info on prices and trends
var stockerConsoleAnnouncements = false;

// Display warning message when broker numbers or bank cookies are insufficient to run automatic trading
var stockerResourcesWarning = true;

// Display more detailed trading info near the top of the stock market display
var stockerAdditionalTradingStats = true;

// Logic loop frequency
var stockerLoopFrequency = 1000 * 30;

// The cheat itself. Rolls the cycle every time logic loop triggers
var stockerForceLoopUpdates = false;

var stockerGreeting = 'click clack you will soon be in debt';


//////////////////////////////
// ----- CONSTANTS / STATE
//////////////////////////////

const CS_TEN_YEARS = 86400 * 365.25 * 10; // seconds
const CS_PLASMIC_PROFITS = 100000000;     // $100,000,000
const CS_BOSE_EINSTEIN_PROFITS = 500000000;// $500,000,000

// Load CCSE if not already present (Steam target URL)
if (typeof CCSE === 'undefined') {
	try { Game.LoadMod('https://klattmose.github.io/CookieClicker/SteamMods/CCSE/main.js'); } catch (e) {}
}

if (typeof CookiStocker === 'undefined') window.CookiStocker = {};
const CookiStocker = window.CookiStocker;

CookiStocker.name        = 'CookiStocker';
CookiStocker.version     = '3.0.3-single';
CookiStocker.GameVersion = '2.053';
CookiStocker.build       = '2025-11-10 single-file';

CookiStocker.Bank = 0;

// Market metadata
const modeDecoder = ['stable','slowly rising','slowly falling','rapidly rising','rapidly falling','chaotic'];
const goodIcons   = [[2,33],[3,33],[4,33],[15,33],[16,33],[17,33],[5,33],[6,33],[7,33],[8,33],[13,33],[14,33],[19,33],[20,33],[32,33],[33,33],[34,33],[35,33]];

// Single grid for mode-transition accounting
let stockerModeProfits = Array.from({length:6},()=>Array.from({length:6},()=>[0,0,0]));

// Core session list
CookiStocker.stockList = {
	Check: 'ok',
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
	shadowGone: false
};
const stockList = CookiStocker.stockList;

// Timers
CookiStocker._tickHookInstalled = 0;
CookiStocker._tickTimeout  = 0;
CookiStocker._reportTimeout = 0;
CookiStocker._loopTimer    = 0;

// Separate reporter interval handle
CookiStocker.reportTimer   = 0;
CookiStocker._reportEveryMs= 0;

// Optional extra stats container id
CookiStocker.extraStatsId  = 'stockerExtra';

// Mirror of boolean prefs for CCSE buttons
CookiStocker.state = {
	stockerAutoTrading:              +!!stockerAutoTrading,
	stockerMarketOn:                 +!!stockerMarketOn,
	stockerAutoBuyMinimumBrokers:    +!!stockerAutoBuyMinimumBrokers,
	stockerAutoBuyAdditionalBrokers: +!!stockerAutoBuyAdditionalBrokers,
	stockerResourcesWarning:         +!!stockerResourcesWarning,
	stockerExponential:              +!!stockerExponential,
	stockerTransactionNotifications: +!!stockerTransactionNotifications,
	stockerActivityReport:           +!!stockerActivityReport,
	stockerFastNotifications:        +!!stockerFastNotifications,
	stockerConsoleAnnouncements:     +!!stockerConsoleAnnouncements,
	stockerAdditionalTradingStats:   +!!stockerAdditionalTradingStats,
	stockerForceLoopUpdates:         +!!stockerForceLoopUpdates,
};

// Small helpers from the game
function l(id){ return document.getElementById(id); }

// CSS once
(function ensureStockerStyles(){
	if (document.getElementById('stocker-styles')) return;
	const css = `
		.stocker-stats{ display:flex; flex-wrap:wrap; justify-content:center; align-items:baseline; gap:0 3px; white-space:normal; }
		.stocker-stats .stat{ white-space:nowrap; font-size:10px; color:rgba(255,255,255,0.8); padding:1px 3px; }
		.stocker-stats .break{ flex-basis:100%; height:0; }
		@media (min-width: 950px){ .stocker-stats .break{ display:none; } }
		.green{ color:#6fff6f !important; }
	`;
	const style = document.createElement('style');
	style.id='stocker-styles';
	style.textContent = css;
	document.head.appendChild(style);
})();

//////////////////////////////
// ----- UI BUILDERS
//////////////////////////////

CookiStocker.buildExtraStatsHTML = function(){
	let html = '';
	html += `
		<div class="stocker-stats">
			<span class="stat">Net cookies won: <span id="netCookies">0</span>.</span>
			<span class="stat">Cookies per hour: <span id="cookiesHour">0</span>.</span>
			<span class="stat">Cookies per day: <span id="cookiesDay">0</span>.</span>
			<span class="stat">Purchases: <span id="Purchases">0</span>.</span>
			<span class="stat">Sales: <span id="Sales">0</span>.</span>
		</div>`;
	html += `
		<div class="stocker-stats">
			<span class="stat">CPS multiple: <span id="cpsMultiple">0</span>.</span>
			<span class="stat">Stocks held: <span id="stocksHeld">${stockList.totalStocks}</span>.</span>
			<span class="stat">Total shares: <span id="totalShares">${Beautify(stockList.totalShares, 0)}</span>.</span>
			<span class="stat">Total value: <span id="totalValue">${Beautify(stockList.totalValue, 2)}</span>.</span>
			<span class="stat">Unrealized profits: <span id="unrealizedProfits">${Beautify(stockList.unrealizedProfits, 0)}</span>.</span>
		</div>`;
	html += `
		<div class="stocker-stats">
			<span class="stat">Profitable stocks: <span id="profitableStocks">0</span>.</span>
			<span class="stat">Unprofitable stocks: <span id="unprofitableStocks">0</span>.</span>
			<span class="stat">Profitable trades: <span id="profitableTrades">0</span>.</span>
			<span class="stat">Unprofitable trades: <span id="unprofitableTrades">0</span>.</span>
			<span class="break"></span>
			<span class="stat">Average profit per trade: <span id="averageProfit">$0</span>.</span>
			<span class="stat">Average loss per trade: <span id="averageLoss">$0</span>.</span>
		</div>`;
	return html;
};

CookiStocker.updateAdditionalStatsVisibility = function(){
	const header = l('bankHeader');
	const host   = header && header.firstChild ? header.firstChild : null;
	if (!host) return;
	let extra = l(CookiStocker.extraStatsId);

	if (stockerAdditionalTradingStats){
		if (!extra){
			extra = document.createElement('div');
			extra.id = CookiStocker.extraStatsId;
			extra.innerHTML = CookiStocker.buildExtraStatsHTML();
			host.appendChild(extra);
		}
		extra.style.display = '';
	}else{
		if (extra) extra.style.display = 'none';
	}
};

function stockerTimeBeautifier(duration) {
	var milliseconds = Math.floor(duration % 1000),
	  seconds = Math.floor((duration / 1000) % 60),
	  minutes = Math.floor((duration / (1000 * 60)) % 60),
	  hours = Math.floor((duration / (1000 * 60 * 60)) % 24),
	  days = Math.floor(duration / (1000 * 60 * 60 * 24));
	if (seconds && (minutes || hours || days) && !stockerForceLoopUpdates) seconds = 0;
	var strSeconds = seconds + ' second' + (seconds != 1 ? 's' : '');
	var strMinutes = minutes ? minutes + ' minute' + (minutes != 1 ? 's' : '') + (seconds ? (hours || days ? ', and ' : ' and ') : '') : '';
	var strHours = hours ? hours + ' hour' + (hours != 1 ? 's' : '') + (minutes && seconds ? ', ' : ((minutes ? !seconds : seconds) ? ' and ' : '')) : '';
	var strDays = days ? days + ' day' + (days != 1 ? 's' : '') + (hours && minutes || hours && seconds || minutes && seconds ? ', ' : (((hours ? !minutes : minutes) ? !seconds : seconds) ? ' and ' : '')) : '';
	var strTime = strDays + strHours + strMinutes;
	if (stockerForceLoopUpdates && seconds) strTime += strSeconds;
	return (minutes || hours || days) ? strTime : strSeconds;
}

//////////////////////////////
// ----- TICK/REPORT TIMERS
//////////////////////////////

CookiStocker._onMarketTick = function() {
	if (Game.OnAscend) return;
	if (CookiStocker._tickTimeout){   clearTimeout(CookiStocker._tickTimeout);   CookiStocker._tickTimeout = 0; }
	if (CookiStocker._reportTimeout){ clearTimeout(CookiStocker._reportTimeout); CookiStocker._reportTimeout = 0; }

	CookiStocker._tickTimeout = setTimeout(function(){
		try {
			if (typeof stockerLoop === 'function') stockerLoop();
			else if (CookiStocker && typeof CookiStocker.stockerLoop === 'function') CookiStocker.stockerLoop();
		}catch(e){}
		var delay = stockerForceLoopUpdates ? 0 : 30000;
		CookiStocker._reportTimeout = setTimeout(function(){
			try{ CookiStocker.Reports(); }catch(e){}
		}, delay);
	}, 500);
};

CookiStocker.installBankTickHook = function(){
	if (CookiStocker._tickHookInstalled) return;
	var M = Game && Game.Objects && Game.Objects['Bank'] && Game.Objects['Bank'].minigame;
	if (!M || typeof M.tick !== 'function') return;

	CookiStocker._tickHookInstalled = 1;
	var _orig = M.tick;
	M.tick = function(){
		var ret = _orig.apply(this, arguments);
		if (typeof stockerMarketOn === 'undefined' || stockerMarketOn) CookiStocker._onMarketTick();
		return ret;
	};
};

CookiStocker.ensureReportTimer = function(){
	// Tear down any existing interval
	if (CookiStocker.reportTimer){
		clearInterval(CookiStocker.reportTimer);
		CookiStocker.reportTimer = 0;
	}
	if (Game.OnAscend) { CookiStocker._reportEveryMs = 0; return; }

	const need = stockerMarketOn && (stockerActivityReport || stockerConsoleAnnouncements);
	const next = need ? Math.max(1000, (+stockerActivityReportFrequency || 3600000)) : 0;
	if (!need){ CookiStocker._reportEveryMs = 0; return; }

	CookiStocker._reportEveryMs = next;
	CookiStocker.reportTimer = setInterval(function(){ CookiStocker.Reports(); }, next);
};

//////////////////////////////
// ----- RUNTIME UI UPDATERS
//////////////////////////////

CookiStocker.DataStats = function(id, value, dollars){
	let it = l(id);
	if (!it) return;
	it.innerHTML = (value < 0 ? "-" : "") + (dollars ? '$' : '') + Beautify(Math.abs(value), 0);
	if (id === "Brokers" && CookiStocker.Bank.brokers < stockerMinBrokers) value = -1;
	else if (id === "bankedCookies") {
		if (Game.cookies > stockList.minCookies && Game.cookies < stockList.maxCookies) {
			it.classList.remove("green");
			it.style.color = 'yellow'; return;
		} else if (Game.cookies < stockList.minCookies) value = -1;
	}
	if (value > 0){ it.classList.add("green"); it.style.color = ''; }
	else if (value < 0){ it.classList.remove("green"); it.classList.remove("yellow"); it.style.color = '#ff3b3b'; }
};

CookiStocker.updateWarn = function(){
	let warn  = l('stockerWarnLine');
	let warn2 = l('stockerWarnLine2');
	let warn3 = l('stockerWarnLine3');
	if (warn)  warn.style.display  = 'none';
	if (warn2) warn2.style.display = 'none';
	if (warn3) warn3.style.display = 'none';
	if (!stockerResourcesWarning) return;

	if (warn3 && !stockerMarketOn){ warn3.style.display=''; return; }
	if (warn2 && !stockerAutoTrading){ warn2.style.display=''; return; }

	if (!warn) return;
	if (CookiStocker.Bank.brokers < stockerMinBrokers){ warn.style.display=''; return; }
	let market = CookiStocker.Bank.goodsById;
	for (let i=0;i<market.length;i++){
		if ((CookiStocker.Bank.getGoodMaxStock(market[i]) - market[i].stock) * Game.cookiesPsRawHighest * market[i].val >= Game.cookies * stockerCookiesThreshold){
			warn.style.display=''; return;
		}
	}
	warn.style.display='none';
};

//////////////////////////////
// ----- REPORTS & STATS
//////////////////////////////

CookiStocker.Reports = function(){
	if (l("Brokers")==null || !stockList.Amount || !stockList.canBuy) return;
	CookiStocker.TradingStats();
	if (stockList.noModActions || (!stockerActivityReport && !stockerConsoleAnnouncements)) return;

	let stockerNotificationTime = stockerFastNotifications * 6;

	if (stockerActivityReport){
		if ((stockList.Purchases + stockList.Sales) == 0){
			Game.Notify(
				`CookiStocker report ${new Date().toLocaleTimeString([], {hourCycle:'h23', hour:'2-digit', minute:'2-digit'})}`,
				`This session has been running for ${stockerTimeBeautifier(stockList.Uptime)}, but no good investment opportunities were detected! Luck is not on our side, yet.`,
				[1,33], stockerNotificationTime
			);
		}else{
			Game.Notify(
				`CookiStocker report ${new Date().toLocaleTimeString([], {hourCycle:'h23', hour:'2-digit', minute:'2-digit'})}`,
				`This session has been running for ${stockerTimeBeautifier(stockList.Uptime)} and has made $${Beautify(stockList.netProfits,0)} in net profits and $${Beautify(stockList.Profits,0)} in revenue in ${Beautify(stockList.Purchases,0)} purchases and ${Beautify(stockList.Sales,0)} sales.`,
				[1,33], stockerNotificationTime
			);
		}
	}

	if (stockerConsoleAnnouncements){
		let totalProfits = 0, deltaTotalProfits = 0, totalTrades = 0;
		for (let j=0;j<6;j++) for (let k=0;k<6;k++) totalProfits += stockerModeProfits[j][k][0];
		for (let j=0;j<6;j++){
			for (let k=0;k<6;k++){
				const profit = stockerModeProfits[j][k][0];
				const last   = stockerModeProfits[j][k][1];
				const trades = stockerModeProfits[j][k][2];
				if (profit || last || trades){
					console.log(`Profits[${j}][${k}] = $${Beautify(profit,2)} ${last?('(Δ $'+Beautify(last,2)+')'):''} ${trades?('('+trades+' trade'+(trades>1?'s':'')+')'):''}`);
				}
				deltaTotalProfits += last;
				totalTrades += trades;
				stockerModeProfits[j][k][1] = 0; // zero deltas after print
			}
		}
		stockList.hourlyProfits = totalProfits * (stockerLoopFrequency / 60000) * 3600000 / (stockList.Uptime+1);
		stockList.dailyProfits  = totalProfits * (stockerLoopFrequency / 60000) * 86400000 / (stockList.Uptime+1);
		if (!stockerForceLoopUpdates){ stockList.hourlyProfits *= 2; stockList.dailyProfits *= 2; }

		console.log(`Total profits = $${Beautify(totalProfits,2)}; Δ $${Beautify(deltaTotalProfits,2)}; trades ${totalTrades}`);
		console.log(`Profit per hour = $${Beautify(stockList.hourlyProfits,2)}; per day = $${Beautify(stockList.dailyProfits,2)}`);
		console.log(`That's ${Beautify(stockList.hourlyProfits*Game.cookiesPsRawHighest,2)} cookies/hour and ${Beautify(stockList.dailyProfits*Game.cookiesPsRawHighest,2)} cookies/day.`);
		console.log('------------------------------------------------------------------');
	}
};

CookiStocker.TradingStats = function(){
	if (!CookiStocker.Bank) return;

	let now = Date.now();
	let M = CookiStocker.Bank;
	let market = M.goodsById;

	if (now > stockList.lastTime + stockerActivityReportFrequency + 500){
		stockList.Start += now - stockList.lastTime - stockerActivityReportFrequency;
	}

	stockList.totalStocks = 0;
	stockList.totalShares = 0;
	stockList.totalValue  = 0;
	stockList.unrealizedProfits = 0;

	for (let i=0;i<market.length;i++){
		if (stockList.Goods[i] && stockList.Goods[i].stock){
			stockList.totalStocks++;
			stockList.totalShares += stockList.Goods[i].stock;
			stockList.totalValue  += stockList.Goods[i].stock * stockList.Goods[i].currentPrice;
			stockList.unrealizedProfits += (market[i].val - market[i].prev) * stockList.Goods[i].stock;
		}
	}

	stockList.minCookies = Number.MAX_VALUE;
	stockList.maxCookies = 0;
	for (let i=0;i<market.length;i++){
		let shares = M.getGoodMaxStock(market[i]) - market[i].stock;
		let cookies = shares * Game.cookiesPsRawHighest * market[i].val / stockerCookiesThreshold;
		if (!stockList.minCookies || (shares && cookies < stockList.minCookies)) stockList.minCookies = cookies;
		if (shares && cookies > stockList.maxCookies) stockList.maxCookies = cookies;
	}

	CookiStocker.DataStats("Brokers", M.brokers, 0);
	CookiStocker.DataStats("brokersNeeded", stockerMinBrokers, 0);
	CookiStocker.DataStats("bankedCookies", Game.cookies, 0);
	CookiStocker.DataStats("minCookies", stockList.minCookies, 0);
	CookiStocker.DataStats("maxCookies", stockList.maxCookies, 0);
	CookiStocker.DataStats("Profits", stockList.netProfits, 1);
	CookiStocker.DataStats("profitsHour", stockList.hourlyProfits, 1);
	CookiStocker.DataStats("profitsDay", stockList.dailyProfits, 1);
	CookiStocker.DataStats("grossProfits", stockList.grossProfits, 1);
	CookiStocker.DataStats("grossLosses", -stockList.grossLosses, 1);

	stockList.lastTime = now;
	stockList.Uptime = Math.floor((now - stockList.Start)/1000)*1000;
	stockList.Uptime -= stockList.Uptime % stockerLoopFrequency;

	let uptimeHours = Math.floor(stockList.Uptime / 3600000);
	let uptimeDays  = Math.floor(uptimeHours / 24);
	if (uptimeDays >= 1){ uptimeDays += ':'; uptimeHours %= 24; if (uptimeHours<10) uptimeHours = '0'+uptimeHours; } else uptimeDays='';

	let it = l("runTime");
	if (it){
		it.innerHTML = uptimeDays + uptimeHours + ':';
		if (stockerForceLoopUpdates) it.innerHTML += new Date(stockList.Uptime).toLocaleTimeString([], {minute:'2-digit', second:'2-digit'});
		else {
			let uptimeMinutes = (Math.floor(stockList.Uptime/60000))%60;
			it.innerHTML += (uptimeMinutes<10?'0':'')+uptimeMinutes;
		}
		if (it.innerHTML === '') it.innerHTML='0:00';
	}

	if (stockerAdditionalTradingStats){
		CookiStocker.DataStats("netCookies", stockList.netProfits * Game.cookiesPsRawHighest, 0);
		CookiStocker.DataStats("cookiesHour", stockList.hourlyProfits * Game.cookiesPsRawHighest, 0);
		CookiStocker.DataStats("cookiesDay",  stockList.dailyProfits  * Game.cookiesPsRawHighest, 0);
		if (l("Purchases")) l("Purchases").innerHTML = stockList.Purchases;
		if (l("Sales"))     l("Sales").innerHTML = stockList.Sales;
		if (l("cpsMultiple")) l("cpsMultiple").innerHTML = stockList.hourlyProfits>=0 ? Beautify(stockList.hourlyProfits/3600,3) : -Beautify(-stockList.hourlyProfits/3600,3);
		if (l("stocksHeld"))   l("stocksHeld").innerHTML = stockList.totalStocks;
		if (l("totalShares"))  l("totalShares").innerHTML = Beautify(stockList.totalShares);
		CookiStocker.DataStats("totalValue", stockList.totalValue, 1);
		CookiStocker.DataStats("unrealizedProfits", stockList.unrealizedProfits, 1);
		if (l("profitableStocks"))   l("profitableStocks").innerHTML = stockList.profitableStocks;
		if (l("unprofitableStocks")) l("unprofitableStocks").innerHTML = stockList.unprofitableStocks;
		if (l("profitableTrades"))   l("profitableTrades").innerHTML = stockList.profitableTrades;
		if (l("unprofitableTrades")) l("unprofitableTrades").innerHTML = stockList.unprofitableTrades;
		CookiStocker.DataStats("averageProfit", stockList.profitableTrades ? stockList.grossProfits/stockList.profitableTrades : 0, 1);
		CookiStocker.DataStats("averageLoss",  stockList.unprofitableTrades ? -stockList.grossLosses/stockList.unprofitableTrades : 0, 1);
	}

	CookiStocker.updateWarn();
};

//////////////////////////////
// ----- OPTIONS & MENU (CCSE)
//////////////////////////////

CookiStocker.calcCommission = function(n){
	const rate = 0.20 * Math.pow(0.95, Math.max(0, Math.min(162, +n||0)));
	return (rate*100).toFixed(3) + "%";
};

CookiStocker.Toggle = function(prefName, button, on, off, invert){
	CookiStocker.state[prefName] = CookiStocker.state[prefName] ? 0 : 1;

	l(button).innerHTML = CookiStocker.state[prefName] ? on : off;
	l(button).className = 'smallFancyButton prefButton option' + ((CookiStocker.state[prefName]^invert) ? '' : ' off');

	switch (prefName){
		case 'stockerAutoTrading':              stockerAutoTrading = !!CookiStocker.state[prefName]; CookiStocker.updateWarn(); break;
		case 'stockerMarketOn':                 stockerMarketOn = !!CookiStocker.state[prefName]; CookiStocker.updateWarn(); CookiStocker.ensureReportTimer(); break;
		case 'stockerAutoBuyMinimumBrokers':    stockerAutoBuyMinimumBrokers = !!CookiStocker.state[prefName]; CookiStocker.TradingStats(); break;
		case 'stockerAutoBuyAdditionalBrokers': stockerAutoBuyAdditionalBrokers = !!CookiStocker.state[prefName]; CookiStocker.TradingStats(); break;
		case 'stockerResourcesWarning':         stockerResourcesWarning = !!CookiStocker.state[prefName]; CookiStocker.updateWarn(); break;
		case 'stockerExponential':              stockerExponential = !!CookiStocker.state[prefName]; break;
		case 'stockerTransactionNotifications': stockerTransactionNotifications = !!CookiStocker.state[prefName]; break;
		case 'stockerActivityReport':           stockerActivityReport = !!CookiStocker.state[prefName]; CookiStocker.ensureReportTimer(); break;
		case 'stockerFastNotifications':        stockerFastNotifications = !!CookiStocker.state[prefName]; break;
		case 'stockerConsoleAnnouncements':     stockerConsoleAnnouncements = !!CookiStocker.state[prefName]; CookiStocker.ensureReportTimer(); break;
		case 'stockerAdditionalTradingStats':   stockerAdditionalTradingStats = !!CookiStocker.state[prefName]; CookiStocker.updateAdditionalStatsVisibility(); break;
		case 'stockerForceLoopUpdates':         stockerForceLoopUpdates = !!CookiStocker.state[prefName]; break;
	}
	PlaySound('snd/tick.mp3');
	Game.UpdateMenu();
};

CookiStocker.ChangeTime = function(prefName, minId, secId){
	let mins = Math.max(0, Math.floor(+l(minId).value || 0));
	let secs = Math.max(0, Math.min(59, Math.floor(+l(secId).value || 0)));
	let ms = (mins*60 + secs) * 1000;

	switch (prefName){
		case 'stockerActivityReportFrequency':
			stockerActivityReportFrequency = ms; CookiStocker.ensureReportTimer(); break;
	}
	PlaySound('snd/tick.mp3');
};
CookiStocker.ChangeNumber = function(prefName, val){
	let v = Math.max(0, Math.floor(+val || 0));
	switch (prefName){
		case 'stockerMinBrokers': stockerMinBrokers = v; break;
		case 'stockerActivityReportFrequency': stockerActivityReportFrequency = v; CookiStocker.ensureReportTimer(); break;
		case 'stockerLoopFrequency':
			stockerLoopFrequency = v;
			if (stockerForceLoopUpdates && CookiStocker.Bank && CookiStocker.Bank.secondsPerTick) {
				CookiStocker.Bank.secondsPerTick = Math.max(0.001, stockerLoopFrequency/1000);
			}
			break;
	}
	PlaySound('snd/tick.mp3');
};

CookiStocker.esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;').replace(/"/g,'&quot;');

CookiStocker.docs = {
	stockerAutoTrading:              "Automatic trading when on",
	stockerMarketOn:                 "Stock market is running when on",
	stockerMinBrokers:               "Minimum number of brokers required for automatic trading",
	stockerCookiesThreshold:         "Percentage of banked cookies allowed for a single automatic trade",
	stockerAutoBuyMinimumBrokers:    "Buy all necessary brokers as soon as you can afford them",
	stockerAutoBuyAdditionalBrokers: "Buy additional brokers as soon as you can afford them",
	stockerResourcesWarning:         "Display warning when market conditions and/or options do not permit auto trading",
	stockerExponential:              "Increase max stock with CPS ratio^exponent",
	stockerExponentialPower:         "Exponent used with the CPS ratio",
	stockerTransactionNotifications: "Announce transactions in game notifications",
	stockerActivityReport:           "Make regular profit reports",
	stockerActivityReportFrequency:  "How often to make regular reports (mm:ss)",
	stockerFastNotifications:        "Make game notifications fade away on their own after 6 seconds",
	stockerConsoleAnnouncements:     "Use console.log for more detailed info",
	stockerAdditionalTradingStats:   "Display extra trading info at the top of the stock market",
	stockerLoopFrequency:            "Logic loop frequency (seconds)",
	stockerForceLoopUpdates:         "Force the market to tick every loop (cheat)"
};
CookiStocker.note = function(key, cheat){
	const t = CookiStocker.esc(CookiStocker.docs[key] || "");
	return t ? (' <span class="smallLabel" style="color:'+(cheat?'#ff3705':'rgba(255,255,255,0.65)')+'">'+t+'</span>') : '';
};

CookiStocker.getMenuString = function(){
	if (!window.CCSE || !CCSE.MenuHelper) return '<div>CCSE not detected — options unavailable.</div>';
	const m = CCSE.MenuHelper;

	const minutes = (stockerActivityReportFrequency||0) / 60000;
	const loopSeconds = Math.floor((stockerLoopFrequency||0)/1000);
	let str = '<div id="csRoot">';

	// Automation
	str += m.Header('Automation');
	str += '<div class="listing">'+ m.ToggleButton(CookiStocker.state,'stockerAutoTrading','CS_autoTrading','Auto Trading ON','Auto Trading OFF',"CookiStocker.Toggle") + CookiStocker.note('stockerAutoTrading',false) +'</div>';
	str += '<div class="listing">'+ m.ToggleButton(CookiStocker.state,'stockerMarketOn','CS_market','Stock Market ON','Stock Market OFF',"CookiStocker.Toggle") + CookiStocker.note('stockerMarketOn',false) +'</div>';
	str += '<div class="listing">'+ m.ToggleButton(CookiStocker.state,'stockerAutoBuyMinimumBrokers','CS_autoBuyMin','Auto-buy Minimum Brokers ON','Auto-buy Minimum Brokers OFF',"CookiStocker.Toggle") + CookiStocker.note('stockerAutoBuyMinimumBrokers',false) +'</div>';
	str += '<div class="listing">'+ m.ToggleButton(CookiStocker.state,'stockerAutoBuyAdditionalBrokers','CS_autoBuyAdd','Auto-buy Additional Brokers ON','Auto-buy Additional Brokers OFF',"CookiStocker.Toggle") + CookiStocker.note('stockerAutoBuyAdditionalBrokers',false) +'</div>';
	str += '<div class="listing">'+ m.ToggleButton(CookiStocker.state,'stockerResourcesWarning','CS_resources','Resources Warning ON','Resources Warning OFF',"CookiStocker.Toggle") + CookiStocker.note('stockerResourcesWarning',false) +'</div>';
	str += '<div class="listing">'+ m.ToggleButton(CookiStocker.state,'stockerExponential','CS_expo','Exponential Warehouses ON','Exponential Warehouses OFF',"CookiStocker.Toggle") + CookiStocker.note('stockerExponential',false) +'</div>';

	var cbWarehouseExponent = "stockerExponentialPower=(l('exponentSlider').value); l('exponentSliderRightText').textContent=stockerExponentialPower; CookiStocker.TradingStats();";
	str += '<div class="listing">'
		+ m.Slider('exponentSlider','Warehouse Exponent','<span id="exponentSliderRightText">'+stockerExponentialPower+'</span>',()=>stockerExponentialPower,cbWarehouseExponent,0.1,3.0,0.1)
		+ ' ' + CookiStocker.note('stockerExponentialPower',false)
		+ '</div>';

	var cbMinBrokers = "stockerMinBrokers=Math.round(l('minBrokersSlider').value);l('minBrokersSliderRightText').textContent=stockerMinBrokers;l('CS_commissionVal').textContent=CookiStocker.calcCommission(stockerMinBrokers);CookiStocker.TradingStats();";
	str += '<div class="listing">'
		+ m.Slider('minBrokersSlider','Minimum Brokers','<span id="minBrokersSliderRightText">'+stockerMinBrokers+'</span>',()=>stockerMinBrokers,cbMinBrokers,0,162,1)
		+ ' <span class="smallLabel">(Commission: <span id="CS_commissionVal">'+CookiStocker.calcCommission(stockerMinBrokers)+'</span>)</span> '
		+ CookiStocker.note('stockerMinBrokers',false)
		+ '</div>';

	var stockerCookiesPercent = Math.round((stockerCookiesThreshold||0)*100);
	var cbCookies = "var v=Math.round(l('cookiesPercentSlider').value); stockerCookiesPercent=v; stockerCookiesThreshold=v/100; l('cookiesPercentSliderRightText').textContent=v+'%'; CookiStocker.TradingStats();";
	str += '<div class="listing">'
		+ m.Slider('cookiesPercentSlider','Max Bank % per Purchase','<span id="cookiesPercentSliderRightText">'+stockerCookiesPercent+'%</span>',()=>stockerCookiesPercent,cbCookies,1,100,1)
		+ ' ' + CookiStocker.note('stockerCookiesThreshold',false)
		+ '</div>';

	// Reporting
	str += m.Header('Reporting & Notifications');
	str += '<div class="listing">'+ m.ToggleButton(CookiStocker.state,'stockerTransactionNotifications','CS_tx','TX Notifications ON','TX Notifications OFF',"CookiStocker.Toggle") + CookiStocker.note('stockerTransactionNotifications',false) +'</div>';
	str += '<div class="listing">'+ m.ToggleButton(CookiStocker.state,'stockerFastNotifications','CS_fast','Fast Notifications ON','Fast Notifications OFF',"CookiStocker.Toggle") + CookiStocker.note('stockerFastNotifications',false) +'</div>';
	str += '<div class="listing">'+ m.ToggleButton(CookiStocker.state,'stockerConsoleAnnouncements','CS_console','Console Announce ON','Console Announce OFF',"CookiStocker.Toggle") + CookiStocker.note('stockerConsoleAnnouncements',false) +'</div>';

	var _arMin = Math.floor(stockerActivityReportFrequency/60000);
	var _arSec = Math.floor((stockerActivityReportFrequency%60000)/1000);
	str += '<div class="listing">'
		+ '<label>Report interval:</label> '
		+ '<input id="CS_activityMin" class="smallInput" type="text" size="5" min="0" value="'+_arMin+'" style="text-align:right;width:3ch;min-width:3ch;max-width:3ch;" inputmode="numeric" oninput="CookiStocker.ChangeTime(\'stockerActivityReportFrequency\',\'CS_activityMin\',\'CS_activitySec\');"> : '
		+ '<input id="CS_activitySec" class="smallInput" type="text" size="5" min="0" max="59" value="'+_arSec+'" style="text-align:right;width:3ch;min-width:3ch;max-width:3ch;" inputmode="numeric" oninput="CookiStocker.ChangeTime(\'stockerActivityReportFrequency\',\'CS_activityMin\',\'CS_activitySec\');"> '
		+ '<span class="smallLabel">mm:ss</span>'
		+ '</div>';

	str += '<div class="listing">'+ m.ToggleButton(CookiStocker.state,'stockerAdditionalTradingStats','CS_moreStats','Extra Trading Stats ON','Extra Trading Stats OFF',"CookiStocker.Toggle") + CookiStocker.note('stockerAdditionalTradingStats',false) +'</div>';

	// Timing
	str += m.Header('Timing (Advanced)');
	str += '<div class="listing">'
		+ '<label>Loop (seconds): </label>'
		+ '<input id="CS_loopFreq" type="text" size="5" value="'+loopSeconds+'" style="text-align:right;width:5ch;min-width:5ch;max-width:5ch;" inputmode="numeric" oninput="CookiStocker.ChangeNumber(\'stockerLoopFrequency\', this.value);" />'
		+ CookiStocker.note('stockerLoopFrequency', true)
		+ '</div>';

	str += '<div class="listing">'+ m.ToggleButton(CookiStocker.state,'stockerForceLoopUpdates','CS_forceLoop','Force Loop (cheat) ON','Force Loop (cheat) OFF',"CookiStocker.Toggle") + CookiStocker.note('stockerForceLoopUpdates', true) +'</div>';

	str += '</div>';
	return str;
};

CookiStocker.ReplaceGameMenu = function(){
	if (!window.CCSE || !CCSE.AppendCollapsibleOptionsMenu || !CCSE.AppendStatsVersionNumber) return;
	Game.customOptionsMenu.push(function(){
		const content = document.createElement('div');
		content.innerHTML = CookiStocker.getMenuString();
		CCSE.AppendCollapsibleOptionsMenu(CookiStocker.name, content);
	});
	Game.customStatsMenu.push(function(){
		CCSE.AppendStatsVersionNumber(CookiStocker.name, CookiStocker.version);
		if (!CookiStocker.Bank || !CookiStocker.Bank.goodsById) return;
		var p = CookiStocker.Bank.profit;
		CCSE.AppendStatsGeneral('<div class="listing"><b>Stock Market has earned you :</b><div class="price plain"> $' + Beautify(p) + ' (' + Game.tinyCookie() + Beautify(p * Game.cookiesPsRawHighest) + ' cookies)</div></div>');
	});
};

//////////////////////////////
// ----- SAVE / LOAD / RESET
//////////////////////////////

CookiStocker.save = function(){
	if (!CookiStocker.Bank) return '';
	let str = '';
	let market = CookiStocker.Bank.goodsById;

	str += Number(stockList.Check);
	for (let i=0;i<market.length;i++){
		str += '_' + encodeURIComponent(stockList.Goods[i].name||'');
		str += '_' + Number(stockList.Goods[i].stock||0);
		str += '_' + Number(market[i].val||0);
		str += '_' + Number(stockList.Goods[i].currentPrice||0);
		str += '_' + Number(stockList.Goods[i].mode||0);
		str += '_' + Number(stockList.Goods[i].lastMode||0);
		str += '_' + Number(stockList.Goods[i].lastDur||0);
		str += '_' + Number(stockList.Goods[i].unchangedDur||0);
		str += '_' + Number(stockList.Goods[i].dropCount||0);
		str += '_' + Number(stockList.Goods[i].riseCount||0);
		str += '_' + Number(stockList.Goods[i].profit||0);
		str += '_' + (+!!stockList.Goods[i].someSold);
		str += '_' + (+!!stockList.Goods[i].someBought);
	}
	str += '_' + Number(stockList.Start);
	str += '_' + Number(stockList.lastTime);
	str += '_' + Number(stockList.startingProfits);
	str += '_' + Number(stockList.Profits);
	str += '_' + Number(stockList.netProfits);
	str += '_' + Number(stockList.grossProfits);
	str += '_' + Number(stockList.grossLosses);
	str += '_' + Number(stockList.totalStocks);
	str += '_' + Number(stockList.totalShares);
	str += '_' + Number(stockList.totalValue);
	str += '_' + Number(stockList.unrealizedProfits);
	str += '_' + Number(stockList.profitableStocks);
	str += '_' + Number(stockList.unprofitableStocks);
	str += '_' + Number(stockList.profitableTrades);
	str += '_' + Number(stockList.unprofitableTrades);
	str += '_' + Number(stockList.Purchases);
	str += '_' + Number(stockList.Sales);
	str += '_' + Number(stockList.Uptime);
	str += '_' + Number(stockList.hourlyProfits);
	str += '_' + Number(stockList.dailyProfits);
	str += '_' + Number(stockList.minCookies);
	str += '_' + Number(stockList.maxCookies);
	str += '_' + (+!!stockList.noModActions);
	str += '_' + Number(stockList.origCookiesPsRawHighest);
	for (let i=0;i<stockerModeProfits.length;i++)
		for (let j=0;j<stockerModeProfits[i].length;j++)
			for (let k=0;k<stockerModeProfits[i][j].length;k++)
				str += '_' + Number(stockerModeProfits[i][j][k]);

	// Options tail (backward-friendly)
	const cfg = {
		stockerAutoTrading,
		stockerMinBrokers,
		stockerAutoBuyMinimumBrokers,
		stockerTransactionNotifications,
		stockerActivityReport,
		stockerActivityReportFrequency,
		stockerFastNotifications,
		stockerConsoleAnnouncements,
		stockerAdditionalTradingStats,
		stockerLoopFrequency,
		stockerForceLoopUpdates,
		stockerCookiesThreshold,
		stockerResourcesWarning,
		stockerMarketOn,
		stockerExponential,
		stockerExponentialPower,
		stockerAutoBuyAdditionalBrokers,
	};
	str += '|CFG:' + JSON.stringify(cfg);
	return str;
};

CookiStocker.load = function(str){
	if (!CookiStocker.Bank || !str || !(stockList.Goods && stockList.Goods[0])) return false;

	let cfg = null;
	let cfgIdx = (str||'').indexOf('|CFG:');
	if (cfgIdx>-1){
		try{ cfg = JSON.parse(str.slice(cfgIdx+5)); }catch(e){ cfg=null; }
		str = str.slice(0, cfgIdx);
	}

	let i=0; let j,k,m;
	let spl = str.split('_');
	let market = CookiStocker.Bank.goodsById;

	stockList.Check = Number(spl[i++]||0);

	for (j=0;j<market.length;j++){
		let tok = (spl[i++]||''); let nm;
		try{ nm = decodeURIComponent(tok); }catch(e){ nm = tok; }
		if (!nm || nm==='NaN') nm = market[j].name;
		stockList.Goods[j].name = nm;

		stockList.Goods[j].stock         = Number(spl[i++]||0);
		stockList.Goods[j].val           = Number(spl[i++]||0);
		stockList.Goods[j].currentPrice  = Number(spl[i++]||0);
		stockList.Goods[j].mode          = Number(spl[i++]||0);
		stockList.Goods[j].lastMode      = Number(spl[i++]||0);
		stockList.Goods[j].lastDur       = Number(spl[i++]||0);
		stockList.Goods[j].unchangedDur  = Number(spl[i++]||0);
		stockList.Goods[j].dropCount     = Number(spl[i++]||0);
		stockList.Goods[j].riseCount     = Number(spl[i++]||0);
		stockList.Goods[j].profit        = Number(spl[i++]||0);
		stockList.Goods[j].someSold      = !!(+spl[i++]||0);
		stockList.Goods[j].someBought    = !!(+spl[i++]||0);
	}

	stockList.Start                = Number(spl[i++]||0);
	stockList.lastTime             = Number(spl[i++]||0);
	stockList.startingProfits      = Number(spl[i++]||0);
	stockList.Profits              = Number(spl[i++]||0);
	stockList.netProfits           = Number(spl[i++]||0);
	stockList.grossProfits         = Number(spl[i++]||0);
	stockList.grossLosses          = Number(spl[i++]||0);
	stockList.totalStocks          = Number(spl[i++]||0);
	stockList.totalShares          = Number(spl[i++]||0);
	stockList.totalValue           = Number(spl[i++]||0);
	stockList.unrealizedProfits    = Number(spl[i++]||0);
	stockList.profitableStocks     = Number(spl[i++]||0);
	stockList.unprofitableStocks   = Number(spl[i++]||0);
	stockList.profitableTrades     = Number(spl[i++]||0);
	stockList.unprofitableTrades   = Number(spl[i++]||0);
	stockList.Purchases            = Number(spl[i++]||0);
	stockList.Sales                = Number(spl[i++]||0);
	stockList.Uptime               = Number(spl[i++]||0);
	stockList.hourlyProfits        = Number(spl[i++]||0);
	stockList.dailyProfits         = Number(spl[i++]||0);
	stockList.minCookies           = Number(spl[i++]||0);
	stockList.maxCookies           = Number(spl[i++]||0);
	stockList.noModActions         = !!(+spl[i++]||0);
	stockList.origCookiesPsRawHighest = Number(spl[i++]||0);

	for (j=0;j<stockerModeProfits.length;j++)
		for (k=0;k<stockerModeProfits[j].length;k++)
			for (m=0;m<stockerModeProfits[j][k].length;m++)
				stockerModeProfits[j][k][m] = Number(spl[i++]||0);

	// Apply config tail
	if (cfg){
		if ('stockerAutoTrading' in cfg)              stockerAutoTrading = !!cfg.stockerAutoTrading;
		if ('stockerMarketOn' in cfg)                 stockerMarketOn = !!cfg.stockerMarketOn;
		if ('stockerMinBrokers' in cfg)               stockerMinBrokers = +cfg.stockerMinBrokers|0;
		if ('stockerCookiesThreshold' in cfg)         stockerCookiesThreshold = +cfg.stockerCookiesThreshold;
		if ('stockerAutoBuyMinimumBrokers' in cfg)    stockerAutoBuyMinimumBrokers = !!cfg.stockerAutoBuyMinimumBrokers;
		if ('stockerAutoBuyAdditionalBrokers' in cfg) stockerAutoBuyAdditionalBrokers = !!cfg.stockerAutoBuyAdditionalBrokers;
		if ('stockerResourcesWarning' in cfg)         stockerResourcesWarning = !!cfg.stockerResourcesWarning;
		if ('stockerExponential' in cfg)              stockerExponential = !!cfg.stockerExponential;
		if ('stockerExponentialPower' in cfg)         stockerExponentialPower = +cfg.stockerExponentialPower || 1.0;
		if ('stockerTransactionNotifications' in cfg) stockerTransactionNotifications = !!cfg.stockerTransactionNotifications;
		if ('stockerActivityReport' in cfg)           stockerActivityReport = !!cfg.stockerActivityReport;
		if ('stockerActivityReportFrequency' in cfg)  stockerActivityReportFrequency = +cfg.stockerActivityReportFrequency|0;
		if ('stockerFastNotifications' in cfg)        stockerFastNotifications = !!cfg.stockerFastNotifications;
		if ('stockerConsoleAnnouncements' in cfg)     stockerConsoleAnnouncements = !!cfg.stockerConsoleAnnouncements;
		if ('stockerAdditionalTradingStats' in cfg)   stockerAdditionalTradingStats = !!cfg.stockerAdditionalTradingStats;
		if ('stockerLoopFrequency' in cfg)            stockerLoopFrequency = +cfg.stockerLoopFrequency|0;
		if ('stockerForceLoopUpdates' in cfg)         stockerForceLoopUpdates = !!cfg.stockerForceLoopUpdates;

		// Clamp
		if (!(stockerCookiesThreshold>0 && stockerCookiesThreshold<=1)) stockerCookiesThreshold = 0.05;
		if (!(stockerLoopFrequency>0)) stockerLoopFrequency = 30000;
		if (stockerLoopFrequency<1000) stockerLoopFrequency = 1000;
		if (!(stockerActivityReportFrequency>0)) stockerActivityReportFrequency = 60000;
		if (stockerActivityReportFrequency<1000) stockerActivityReportFrequency = 1000;
		if (stockerMinBrokers<0) stockerMinBrokers=0;
		if (stockerMinBrokers>162) stockerMinBrokers=162;

		// Sync mirrored state
		CookiStocker.state.stockerAutoTrading              = +!!stockerAutoTrading;
		CookiStocker.state.stockerMarketOn                 = +!!stockerMarketOn;
		CookiStocker.state.stockerAutoBuyMinimumBrokers    = +!!stockerAutoBuyMinimumBrokers;
		CookiStocker.state.stockerAutoBuyAdditionalBrokers = +!!stockerAutoBuyAdditionalBrokers;
		CookiStocker.state.stockerResourcesWarning         = +!!stockerResourcesWarning;
		CookiStocker.state.stockerExponential              = +!!stockerExponential;
		CookiStocker.state.stockerTransactionNotifications = +!!stockerTransactionNotifications;
		CookiStocker.state.stockerActivityReport           = +!!stockerActivityReport;
		CookiStocker.state.stockerFastNotifications        = +!!stockerFastNotifications;
		CookiStocker.state.stockerConsoleAnnouncements     = +!!stockerConsoleAnnouncements;
		CookiStocker.state.stockerAdditionalTradingStats   = +!!stockerAdditionalTradingStats;
		CookiStocker.state.stockerForceLoopUpdates         = +!!stockerForceLoopUpdates;

		CookiStocker.ensureReportTimer();
		CookiStocker.updateAdditionalStatsVisibility();
	}

	if (l('bankHeader')) CookiStocker.TradingStats();
	return true;
};

CookiStocker.reset = function(hard){
	if (!CookiStocker.Bank) return;
	if (CookiStocker._loopTimer){ clearInterval(CookiStocker._loopTimer); CookiStocker._loopTimer=0; }

	let M = CookiStocker.Bank;
	let market = M.goodsById;

	stockList.Goods = [];
	for (let i=0;i<market.length;i++){
		stockList.Goods.push({
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
			someBought: false
		});
	}
	stockList.Start = Date.now() + 500;
	stockList.lastTime = Date.now() + 500;
	stockList.startingProfits = 0;
	stockList.Profits = 0;
	stockList.netProfits = 0;
	stockList.grossProfits = 0;
	stockList.grossLosses = 0;
	stockList.totalStocks = 0;
	stockList.totalShares = 0;
	stockList.totalValue = 0;
	stockList.unrealizedProfits = 0;
	stockList.profitableStocks = 0;
	stockList.unprofitableStocks = 0;
	stockList.profitableTrades = 0;
	stockList.unprofitableTrades = 0;
	stockList.Purchases = 0;
	stockList.Sales = 0;
	stockList.Uptime = 0;
	stockList.hourlyProfits = 0;
	stockList.dailyProfits = 0;
	stockList.minCookies = Number.MAX_VALUE;
	stockList.maxCookies = 0;
	stockList.noModActions = true;
	stockList.Amount = 0;

	for (let i=0;i<stockerModeProfits.length;i++)
		for (let j=0;j<stockerModeProfits[i].length;j++)
			for (let k=0;k<stockerModeProfits[i][j].length;k++)
				stockerModeProfits[i][j][k]=0;

	if (CookiStocker._tickTimeout){ clearTimeout(CookiStocker._tickTimeout); CookiStocker._tickTimeout=0; }
	if (CookiStocker._reportTimeout){ clearTimeout(CookiStocker._reportTimeout); CookiStocker._reportTimeout=0; }

	if (hard){
		stockerMarketOn = true;
		stockList.origCookiesPsRawHighest = 0;
	}
};

//////////////////////////////
// ----- LAUNCH & CORE LOOP
//////////////////////////////

CookiStocker.launch = function(){
	try{
		if (Game && Game.Objects && Game.Objects['Bank'] && Game.Objects['Bank'].minigame){
			CookiStocker.Bank = Game.Objects['Bank'].minigame;
			if (CookiStocker._tickTimeout){ clearTimeout(CookiStocker._tickTimeout); CookiStocker._tickTimeout=0; }
			if (CookiStocker._reportTimeout){ clearTimeout(CookiStocker._reportTimeout); CookiStocker._reportTimeout=0; }
			CookiStocker.isLoaded = 1;
		}
	}catch(e){}
};

// Install CCSE hook if present later
if (!CookiStocker.isLoaded){
	if (typeof CCSE !== 'undefined' && CCSE){
		if (!CCSE.postLoadHooks) CCSE.postLoadHooks = [];
		CCSE.postLoadHooks.push(function(){ try{ CookiStocker.launch(); }catch(e){} });
	}
}

// ---------- Mod registration (all functions already defined above) ----------
Game.registerMod('CookiStocker', {
	init: function () {
		Game.registerHook('reset', function (hard){ CookiStocker.reset(hard); });

		// Wire Options/Stats menus once CCSE is truly ready
		(function waitCCSE(tries){
			if (typeof CCSE !== 'undefined'
				&& typeof CCSE.AppendCollapsibleOptionsMenu === 'function'
				&& typeof CCSE.AppendStatsVersionNumber === 'function') {
				try {
					CookiStocker.ReplaceGameMenu();
				}catch(e){
					console.warn('[CookiStocker] ReplaceGameMenu failed; will retry shortly:', e);
					if (tries>0) setTimeout(function(){ waitCCSE(tries-1); }, 250);
					return;
				}
			}else if (tries>0){
				setTimeout(function(){ waitCCSE(tries-1); }, 250);
			}else{
				console.warn('[CookiStocker] CCSE not detected; Options/Stats menu will not be installed.');
			}
		})(120); // up to ~30s

		Game.Notify('CookiStocker is loaded', stockerGreeting, [1,33], false);

		this.startStocking();
	},

	save: function(){ return CookiStocker.save(); },

	load: function (str) {
		var tries = 0;
		(function tryLoad(){
			var bankReady =
				typeof Game === 'object' && Game.ready &&
				Game.Objects && Game.Objects['Bank'] &&
				Game.Objects['Bank'].minigame && stockList.Goods[0];

			if (bankReady){
				try{
					if (!CookiStocker.Bank) CookiStocker.Bank = Game.Objects['Bank'].minigame;
					CookiStocker.load(str || '');
				}catch(e){
					console.warn('[CookiStocker] load failed:', e);
				}
			}else{
				if (tries++ < 120) setTimeout(tryLoad, 250);
				else console.warn('[CookiStocker] load skipped (Bank minigame never became ready).');
			}
		})();
	},

	startStocking: function(){
		const M = Game.Objects['Bank'].minigame;
		if (!M){
			setTimeout(()=>this.startStocking(), 500);
			return;
		}
		CookiStocker.Bank = M;

		console.log('=====$$$=== CookiStocker logic loop initialised at ' + new Date());
		console.log('=====$$$=== With main options as follows:');
		console.log('=====$$$=== Logic loop frequency: ' + stockerTimeBeautifier(stockerLoopFrequency));
		console.log('=====$$$=== Report frequency: ' + stockerTimeBeautifier(stockerActivityReportFrequency));
		console.log('=====$$$=== Cheating: ' + stockerForceLoopUpdates);

		// Patch max stock multiplier (no achievements)
		if (!CookiStocker.patchedMaxStock){
			var oldGet = M.getGoodMaxStock;
			M.getGoodMaxStock = function(good){
				var base = oldGet.call(this, good);
				if (this.officeLevel < 3 || stockList.Profits < CS_PLASMIC_PROFITS) return base;

				let mult = 1;
				if (Game.Objects['Bank'].level >= 12){
					if (stockerExponential && stockList.origCookiesPsRawHighest){
						var ratio = Math.max(1, Game.cookiesPsRawHighest / stockList.origCookiesPsRawHighest);
						mult *= Math.pow(ratio, stockerExponentialPower);
					}
					if (stockList.Profits >= CS_PLASMIC_PROFITS * mult)        mult *= 2;
					if (stockList.Profits >= CS_BOSE_EINSTEIN_PROFITS * mult)  mult *= 2;
				}
				return Math.ceil(base * mult);
			};
			CookiStocker.patchedMaxStock = true;
		}

		CookiStocker.installBankTickHook();

		// Header lines
		let datStr = `
			<div class="stocker-stats">
				<span class="stat">Net profits: <span id="Profits">$0</span>.</span>
				<span class="stat">Profits per hour: <span id="profitsHour">$0</span>.</span>
				<span class="stat">Profits per day: <span id="profitsDay">$0</span>.</span>
				<span class="stat">Gross profits: <span id="grossProfits">$0</span>.</span>
				<span class="stat">Gross losses: <span id="grossLosses">$0</span>.</span>
				<span class="stat">Runtime: <span id="runTime">${stockerForceLoopUpdates ? "0:00:00" : "0:00"}</span></span>
			</div>`;
		let datStrWarn = `
			<div class="stocker-stats" id="stockerWarnLine" style="display:none;">
				<span class="stat" style="font-size:12px;color:#ff3b3b;font-weight:bold;">
				THERE ARE INSUFFICENT RESOURCES TO RUN AUTOMATIC TRADING. PLEASE SEE THE FOLLOWING LINE AND READ THE STEAM GUIDE.
				</span>
			</div>`;
		let datStrWarn2 = `
			<div class="stocker-stats" id="stockerWarnLine2" style="display:none;">
				<span class="stat" style="font-size:12px;color:#ff3b3b;font-weight:bold;">
				AUTO TRADING IS TURNED OFF IN THE OPTIONS.
				</span>
			</div>`;
		let datStrWarn3 = `
			<div class="stocker-stats" id="stockerWarnLine3" style="display:none;">
				<span class="stat" style="font-size:12px;color:#ff3b3b;font-weight:bold;">
				THE STOCK MARKET IS TURNED OFF IN THE OPTIONS.
				</span>
			</div>`;
		let datStr1 = `
			<div class="stocker-stats">
				<span class="stat">Brokers: <span id="Brokers">0</span>.</span>
				<span class="stat">Brokers Needed: <span id="brokersNeeded">0</span>.</span>
				<span class="stat">Banked cookies: <span id="bankedCookies">0</span>.</span>
				<span class="stat">Required cookie minimum: <span id="minCookies">0</span>.</span>
				<span class="stat">Maximum: <span id="maxCookies">0</span>.</span>
			</div>`;

		if (l('bankHeader') && l('bankHeader').firstChild){
			const host = l('bankHeader').firstChild;
			host.insertAdjacentHTML('beforeend', datStr);
			host.insertAdjacentHTML('beforeend', datStrWarn);
			host.insertAdjacentHTML('beforeend', datStrWarn2);
			host.insertAdjacentHTML('beforeend', datStrWarn3);
			host.insertAdjacentHTML('beforeend', datStr1);

			let extra = l(CookiStocker.extraStatsId);
			if (!extra){
				extra = document.createElement('div');
				extra.id = CookiStocker.extraStatsId;
				host.appendChild(extra);
			}
			if (stockerAdditionalTradingStats){
				extra.innerHTML = CookiStocker.buildExtraStatsHTML();
				extra.style.display='';
			}else{
				extra.innerHTML='';
				extra.style.display='none';
			}
		}

		// seed goods
		let market = M.goodsById;
		stockList.startingProfits = M.profit;
		for (let i=0;i<market.length;i++){
			stockList.Goods.push({
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
				someBought: false
			});
		}

		CookiStocker.ensureReportTimer();
		CookiStocker.TradingStats();

		if (CookiStocker._loopTimer){ clearInterval(CookiStocker._loopTimer); CookiStocker._loopTimer=0; }
		CookiStocker._loopTimer = setInterval(function(){
			if (Game.OnAscend || (typeof Game.AscendTimer!=='undefined' && Game.AscendTimer>0) || l("Brokers")==null) return;

			if (stockerMarketOn){
				if (stockList.noModActions){ stockList.noModActions=false; CookiStocker.TradingStats(); }
				if (stockerForceLoopUpdates) M.secondsPerTick = Math.max(0.001, stockerLoopFrequency/1000);
				else                         M.secondsPerTick = 60;
			}else{
				if (stockList.noModActions) return;
				M.secondsPerTick = CS_TEN_YEARS;
			}

			let doUpdate=false;
			if (!stockerForceLoopUpdates && stockerMarketOn) stockerLoopFrequency = M.secondsPerTick*500;

			const smallDelta = 3, largeDelta = 4, alwaysBuyBelow = 2, neverSellBelow = 11;

			// broker autobuy
			if (!Game.OnAscend && (stockerAutoBuyMinimumBrokers || stockerAutoBuyAdditionalBrokers)){
				let tradingStats=false, cost;
				let buyBrokers = stockerMinBrokers - M.brokers;
				if (stockerAutoBuyMinimumBrokers && buyBrokers>0 && stockerMinBrokers <= M.getMaxBrokers() && buyBrokers*M.getBrokerPrice() < Game.cookies*0.1){
					Game.Spend(M.getBrokerPrice()*buyBrokers);
					M.brokers = stockerMinBrokers; tradingStats=true;
				}
				let buyMore = M.getMaxBrokers() - M.brokers;
				if (stockerAutoBuyAdditionalBrokers && buyMore>0 && (cost=M.getBrokerPrice()*buyMore) < Game.cookies*0.1){
					Game.Spend(cost); M.brokers += buyMore; tradingStats=true;
				}
				if (tradingStats) CookiStocker.TradingStats();
			}

			let market = M.goodsById;
			stockList.canBuy = stockerAutoTrading && M.brokers >= stockerMinBrokers;

			let totalAmount=0;
			for (let i=0;i<market.length;i++){
				if (stockList.canBuy && !((M.getGoodMaxStock(market[i]) - market[i].stock) * Game.cookiesPsRawHighest * market[i].val < Game.cookies * stockerCookiesThreshold)){
					let now=Date.now(), remainder;
					stockList.Start += now - stockList.lastTime;
					stockList.Uptime = Math.floor((now - stockList.Start)/1000)*1000;
					if (remainder = stockList.Uptime % stockerLoopFrequency){
						stockList.Start += M.secondsPerTick*1000 + remainder;
						stockList.Uptime -= M.secondsPerTick*1000 + remainder;
					}
					stockList.lastTime = now;
					CookiStocker.TradingStats();
					stockList.canBuy=false;
					if (!stockerAutoTrading){
						stockList.noModActions=true;
						if (CookiStocker.reportTimer){ clearInterval(CookiStocker.reportTimer); CookiStocker.reportTimer=null; }
					}
				}
				totalAmount += Game.ObjectsById[i+2].amount;
			}
			if (!(stockList.Amount = totalAmount)) return;

			CookiStocker.TradingStats();
			CookiStocker.ensureReportTimer();

			if (stockList.canBuy && !stockList.origCookiesPsRawHighest) stockList.origCookiesPsRawHighest = Game.cookiesPsRawHighest;

			for (let i=0;i<market.length;i++){
				let stockerNotificationTime = stockerFastNotifications*6;
				let lastPrice = stockList.Goods[i].currentPrice;
				let currentPrice = market[i].val;

				stockList.Goods[i].stock = market[i].stock;
				stockList.Goods[i].currentPrice = market[i].val;
				stockList.Goods[i].mode = market[i].mode;

				let md  = stockList.Goods[i].mode;
				let lmd = stockList.Goods[i].lastMode;
				let lastStock = market[i].stock;
				let deltaPrice = largeDelta;
				let stockName = market[i].name.replace('%1', Game.bakeryName);

				let ceilingPrice = Math.max(10*(i+1) + Game.Objects['Bank'].level + 49, 97 + Game.Objects['Bank'].level*3);

				if (stockList.Goods[i].lastDur != market[i].dur || ++stockList.Goods[i].unchangedDur > 1){ stockList.Goods[i].unchangedDur = 0; doUpdate = true; }

				if (lmd==md && (stockList.Goods[i].stock && (md==2 || md==4) || !stockList.Goods[i].stock && (md==1 || md==3))) deltaPrice = smallDelta;

				if (md!=lmd && (md==3 && lmd!=1 || md==4 && lmd!=2 || md==1 && lmd!=3 || md==2 && lmd!=4)){
					stockList.Goods[i].dropCount=0; stockList.Goods[i].riseCount=0;
				}else if (currentPrice>lastPrice){ stockList.Goods[i].dropCount=0; stockList.Goods[i].riseCount++; }
				else if (currentPrice<lastPrice){ stockList.Goods[i].riseCount=0; stockList.Goods[i].dropCount++; }

				stockList.Goods[i].lastDur = market[i].dur;

				// BUY
				if (
					(
						currentPrice < alwaysBuyBelow ||
						(md != 4 && (
							(currentPrice > lastPrice && stockList.Goods[i].riseCount >= deltaPrice) ||
							((md==1 || md==3) && md != lmd) ||
							(md==0 && !stockList.Goods[i].someSold && stockList.Goods[i].dropCount < deltaPrice && currentPrice>=10)
						) && (currentPrice < ceilingPrice || md==1 || md==3))
					)
					&& stockList.canBuy
					&& ((M.getGoodMaxStock(market[i]) - market[i].stock) * Game.cookiesPsRawHighest * market[i].val < Game.cookies * stockerCookiesThreshold && M.brokers >= stockerMinBrokers)
					&& M.buyGood(i,10000)
				){
					let units = market[i].stock - lastStock;
					stockList.Goods[i].someBought = true;
					stockList.Goods[i].stock = market[i].stock;
					market[i].buyTime = Date.now();
					stockList.Purchases++;
					if (stockerTransactionNotifications){
						if (currentPrice>=2)
							Game.Notify(`Buying ${stockName} ${new Date().toLocaleTimeString([], {hourCycle:'h23', hour:'2-digit', minute:'2-digit'})}`,`Buying ${units} unit${(units>1?'s':'')}. Price $${Beautify(market[i].prev,2)}; now ${modeDecoder[md]}.`,goodIcons[i],stockerNotificationTime);
						else
							Game.Notify(`Buying ${stockName} ${new Date().toLocaleTimeString([], {hourCycle:'h23', hour:'2-digit', minute:'2-digit'})}`,`Buying ${units} unit${(units>1?'s':'')}. Dropped below $2; buy price $${Beautify(market[i].prev,2)}.`,goodIcons[i],stockerNotificationTime);
					}
				}
				// SELL
				else if (
					stockList.Goods[i].stock > 0 &&
					((currentPrice < lastPrice && stockList.Goods[i].dropCount >= deltaPrice) || ((md==2 || md==4) && md != lmd)) &&
					currentPrice >= neverSellBelow
				){
					if (!M.sellGood(i, stockList.Goods[i].stock)) { stockList.Goods[i].lastMode = stockList.Goods[i].mode; continue; }
					stockList.Goods[i].someSold = true;
					market[i].sellTime = Date.now();
					stockList.Sales++;

					let profit = (market[i].val - market[i].prev) * stockList.Goods[i].stock;
					stockList.Goods[i].profit += profit;
					if (profit>0){ stockList.grossProfits += profit; stockList.profitableTrades++; }
					else { stockList.grossLosses += -profit; stockList.unprofitableTrades++; }
					stockList.netProfits += profit;
					stockerModeProfits[lmd][md][0] += profit;
					stockerModeProfits[lmd][md][1] += profit;
					stockerModeProfits[lmd][md][2]++;

					if (stockerTransactionNotifications){
						let pos = profit>=0;
						let amount = pos?profit:-profit;
						Game.Notify(
							`Selling ${stockName} ${new Date().toLocaleTimeString([], {hourCycle:'h23', hour:'2-digit', minute:'2-digit'})}`,
							`Sold ${stockList.Goods[i].stock} at $${Beautify(market[i].val,2)} for a ${pos?'profit':'loss'} of $${Beautify(amount,2)}.`,
							goodIcons[i], stockerNotificationTime
						);
					}
				}

				stockList.Profits = M.profit - stockList.startingProfits;
				stockList.Goods[i].lastMode = stockList.Goods[i].mode;
			}

			stockList.profitableStocks = 0; stockList.unprofitableStocks = 0;
			for (let i=0;i<market.length;i++){
				if (stockList.Goods[i].profit > 0) stockList.profitableStocks++;
				else if (stockList.Goods[i].profit < 0) stockList.unprofitableStocks++;
			}

			CookiStocker.TradingStats();

			if (!stockerMarketOn){
				if (CookiStocker.reportTimer){ clearInterval(CookiStocker.reportTimer); CookiStocker.reportTimer=null; }
				CookiStocker.Reports();
				stockList.noModActions = true;
				return;
			}
		}, stockerLoopFrequency);
	},
});
