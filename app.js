const liveAccountProfile = 'https://www.myfxbook.com/members/buildupmarketfx/abu-issah/12211403';
const liveSyncUrl = '/api/live-account';

const competitorsData = [
  {
    name: 'Abu Issah',
    alias: 'ABU_ISSAH',
    startBalance: 100000,
    currentEquity: 100000,
    winRate: 0,
    trades: 0,
    consistency: 100,
    profileUrl: liveAccountProfile
  }
];

const formatCurrency = value => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const calculateROI = ({ startBalance, currentEquity }) => ((Number(currentEquity || startBalance) - Number(startBalance || 0)) / Number(startBalance || 1)) * 100;

const marketSessions = [
  { name: 'NEW YORK', timeZone: 'America/New_York', open: 8, close: 17 },
  { name: 'LONDON', timeZone: 'Europe/London', open: 8, close: 17 },
  { name: 'TOKYO', timeZone: 'Asia/Tokyo', open: 9, close: 18 },
  { name: 'SYDNEY', timeZone: 'Australia/Sydney', open: 8, close: 17 }
];

function getLocalMarketTime(timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(new Date());
  return {
    weekday: parts.find(part => part.type === 'weekday').value,
    hour: Number(parts.find(part => part.type === 'hour').value)
  };
}

function updateMarketSession() {
  const sessionElement = document.querySelector('#marketSession');
  const pulseElement = document.querySelector('#sessionPulse');
  const referenceTime = getLocalMarketTime('Europe/London');
  const isWeekend = ['Sat', 'Sun'].includes(referenceTime.weekday);
  const activeSession = marketSessions.find(session => {
    const localTime = getLocalMarketTime(session.timeZone);
    return !['Sat', 'Sun'].includes(localTime.weekday) && localTime.hour >= session.open && localTime.hour < session.close;
  });

  if (activeSession) {
    sessionElement.textContent = `${activeSession.name} / OPEN`;
    pulseElement.classList.remove('session-closed');
  } else {
    sessionElement.textContent = isWeekend ? 'WEEKEND / CLOSED' : 'MARKET PAUSE / CLOSED';
    pulseElement.classList.add('session-closed');
  }
}

function getStatus(roi, rank) {
  if (rank === 1) return { label: '🔥 Leader', className: 'leader' };
  if (roi < 0) return { label: 'Risk watch', className: 'watch' };
  if (roi >= 20) return { label: 'High conviction', className: '' };
  return { label: 'Trading', className: '' };
}

function renderLeaderboard() {
  const rankedCompetitors = competitorsData
    .map(competitor => ({ ...competitor, roi: calculateROI(competitor) }))
    .sort((a, b) => b.roi - a.roi);
  const leaderboardBody = document.querySelector('#leaderboardBody');

  leaderboardBody.innerHTML = rankedCompetitors.map((competitor, index) => {
    const rank = index + 1;
    const status = getStatus(competitor.roi, rank);
    const initials = competitor.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
    const rankMarkup = rank <= 3
      ? `<span class="rank-badge rank-${rank}">${rank}</span>`
      : `<span class="rank-other">${String(rank).padStart(2, '0')}</span>`;

    return `<tr>
      <td>${rankMarkup}</td>
      <td><div class="trader"><span class="avatar">${initials}</span><span>${competitor.name}<span class="sub-label">${competitor.alias}</span></span></div></td>
      <td class="currency">${formatCurrency(competitor.startBalance)}</td>
      <td class="currency">${formatCurrency(competitor.currentEquity)}</td>
      <td class="win-rate">${competitor.winRate.toFixed(1)}%</td>
      <td class="trade-count">${competitor.trades}</td>
      <td class="consistency ${competitor.consistency < 70 ? 'below-target' : ''}">${competitor.consistency}%</td>
      <td class="return-value">+${competitor.roi.toFixed(2)}%</td>
      <td><span class="status-tag ${status.className}">${status.label}</span></td>
    </tr>`;
  }).join('');

  const leader = rankedCompetitors[0];
  document.querySelector('#activeCompetitors').textContent = competitorsData.length;
  document.querySelector('#topReturn').textContent = `+${leader.roi.toFixed(2)}%`;
  document.querySelector('#topTrader').textContent = leader.name;
  document.querySelector('#resultCount').textContent = competitorsData.length;
  document.querySelector('#leaderBalance').textContent = formatCurrency(leader.currentEquity);
  document.querySelector('#leaderEquity').textContent = formatCurrency(leader.currentEquity);
  document.querySelector('#leaderRoi').textContent = `+${leader.roi.toFixed(2)}%`;
}

async function refreshLiveAccountData() {
  const liveStatusValue = document.querySelector('#liveStatusValue');
  const lastUpdatedValue = document.querySelector('#lastUpdatedValue');

  if (!liveStatusValue || !lastUpdatedValue) return;

  try {
    const response = await fetch(liveSyncUrl, { cache: 'no-store' });
    const data = await response.json();

    if (data && data.hasData !== false) {
      liveStatusValue.textContent = 'Connected to Myfxbook';
      lastUpdatedValue.textContent = data.updated || 'Updated just now';

      competitorsData[0].currentEquity = Number(data.equity || competitorsData[0].currentEquity);
      competitorsData[0].startBalance = Number(data.balance || competitorsData[0].startBalance);
      competitorsData[0].winRate = Number(data.gain || 0);
      competitorsData[0].consistency = Math.max(0, 100 - Number(data.drawdown || 0));
      renderLeaderboard();
      return;
    }
  } catch (error) {
    console.warn('Live sync unavailable:', error);
  }

  liveStatusValue.textContent = 'Waiting for live sync';
  lastUpdatedValue.textContent = 'Checking Myfxbook';
}

renderLeaderboard();
updateMarketSession();
refreshLiveAccountData();
setInterval(updateMarketSession, 30000);
setInterval(refreshLiveAccountData, 60000);
