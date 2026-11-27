'use strict';

const TravelSurveys = (() => {
  /** @typedef {{surveyId:string, sourceId:string, surveyTitle:string, country:string,
   * geographicCoverage:string, destinationId:string, referencePeriod:{start:string,end:string,label:string},
   * population:string, sampleSize?:number, categories:{id:string,label:string,value:number}[],
   * units:'percent'|'people', methodology:string, limitations:string,
   * dataStatus:'synthetic'|'verified', sourceUrl?:string}} Survey
   */
  /** @type {Survey[]} */
  const surveys = [{
    surveyId: 'demo-mx-2026-01', sourceId: 'simulation-project', surveyTitle: 'Distribución ilustrativa de motivos',
    country: 'MX', geographicCoverage: 'México · alcance nacional ilustrativo', destinationId: 'country:MX',
    referencePeriod: { start: '2026-01-01', end: '2026-01-31', label: 'Enero de 2026' },
    population: 'Personas viajeras de una población ficticia', units: 'percent', dataStatus: 'synthetic',
    categories: [{ id: 'leisure', label: 'Ocio o vacaciones', value: 50 },
      { id: 'business', label: 'Negocios', value: 20 },
      { id: 'visits', label: 'Visitas a familiares o amigos', value: 30 }],
    methodology: 'Valores creados por el proyecto para demostrar el control.',
    limitations: 'Distribución del periodo completo, sin estimación diaria ni correspondencia con los vuelos del telar.'
  }];
  function compatibleSurvey(destinationId, day, sources = surveys) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
    return sources.find(survey => survey.destinationId === destinationId &&
      survey.referencePeriod.start <= day && day <= survey.referencePeriod.end);
  }


  // Verified passenger surveys stay a separate evidence series. Their categories
  // are reported in their original units and are never mapped to aircraft counts.
  function verifiedMotives(sources, destinationId, day) {
    const documented = sources.filter(row => row.dataStatus === 'verified'
      && row.population?.trim() && row.geographicCoverage?.trim()
      && row.referencePeriod?.label && row.methodology?.trim()
      && /^https:\/\//.test(row.sourceUrl ?? ''));
    return compatibleSurvey(destinationId, day, documented);
  }

  return { compatibleSurvey, verifiedMotives };
})();
if (typeof module !== 'undefined') module.exports = TravelSurveys;
