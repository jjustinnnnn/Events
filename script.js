function buildFeatures() {
  const now = new Date();
  const today = startOfToday();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();
  const todayWeek = getWeekOfYear(now);
  const currentYear = now.getFullYear();

  const dayMatches = rows
    .filter(r => {
      const d = parseFlexibleDate(r.Date);
      return (
        d &&
        d.getFullYear() !== currentYear &&
        startOfDay(d).getTime() <= today.getTime() &&
        d.getMonth() === todayMonth &&
        d.getDate() === todayDay
      );
    })
    .sort(
      (a, b) =>
        (parseFlexibleDate(b.Date)?.getTime() || 0) -
        (parseFlexibleDate(a.Date)?.getTime() || 0)
    );

  const weekMatches = rows
    .filter(r => {
      const d = parseFlexibleDate(r.Date);
      return (
        d &&
        d.getFullYear() !== currentYear &&
        startOfDay(d).getTime() <= today.getTime() &&
        getWeekOfYear(d) === todayWeek
      );
    })
    .sort(
      (a, b) =>
        (parseFlexibleDate(b.Date)?.getTime() || 0) -
        (parseFlexibleDate(a.Date)?.getTime() || 0)
    );

  const upcomingMatches = rows
    .map(r => ({ ...r, _date: parseFlexibleDate(r.Date) }))
    .filter(r => r._date && startOfDay(r._date).getTime() > today.getTime())
    .sort((a, b) => a._date - b._date)
    .slice(0, 3);

  els.dayFeature.innerHTML = dayMatches.length
    ? dayMatches.map(featureCard).join('')
    : 'No historical matches for today yet. Go to more concerts!';

  els.weekFeature.innerHTML = weekMatches.length
    ? weekMatches.map(featureCard).join('')
    : 'No historical matches for this week yet.';

  els.upcomingFeature.innerHTML = upcomingMatches.length
    ? upcomingMatches.map(featureCard).join('')
    : 'No upcoming events found.';
}
