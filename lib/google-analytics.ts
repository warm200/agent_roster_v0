export function buildGoogleAnalyticsInlineScript(measurementId: string) {
  const escapedMeasurementId = JSON.stringify(measurementId)

  return `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
window.__openRosterGaMeasurementId = ${escapedMeasurementId};
gtag('js', new Date());
gtag('config', ${escapedMeasurementId}, { send_page_view: false });
`.trim()
}
