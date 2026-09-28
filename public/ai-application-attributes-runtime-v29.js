/* The calendar date remains unknown without a trusted reference. Relative time is still useful. */
(() => {
  const revision=33;
  function clockContext(source,match){
    const hour=Number(match[1]),tail=String(source).slice(match.index+match[0].search(/\d/),match.index+match[0].length+18);
    const qualifier=(tail.match(/^\d{1,2}(?:[:.]\d{2})?\s*(?:час(?:а|ов)?)?\s+(утра|утром|дня|днем|вечера|вечером|ночи|ночью)(?![а-я])/)||[])[1];
    const explicit=match[1].length===2&&match[1].startsWith('0');
    return {hour:hour<12&&['дня','днем','вечера','вечером'].includes(qualifier)?hour+12:hour===12&&['ночи','ночью'].includes(qualifier)?0:hour,
      ambiguous:hour>0&&hour<12&&!explicit&&!qualifier};
  }
  function relativeTime(expression,offsetMinutes=0){
    const source=String(expression||'').toLowerCase().replace(/ё/g,'е');
    if(!Number.isInteger(offsetMinutes)||Math.abs(offsetMinutes)>10080) return null;
    // Do not silently choose a point inside a range or a conditional/negated time.
    if(/(?:[–—-]|или|примерно|около|не раньше|не позже|после\s+\d|до\s+\d|если)/.test(source)) return null;
    const days=[...source.matchAll(/послезавтра|завтра|сегодня/g)];
    if(days.length!==1) return null;
    const times=[...source.matchAll(/(?:^|\s)(?:в\s+)?([01]?\d|2[0-3]):([0-5]\d)(?!\d)/g)];
    let hour,minute;
    if(times.length===1){const clock=clockContext(source,times[0]);if(clock.ambiguous)return null;hour=clock.hour;minute=+times[0][2];}
    else if(times.length>1)return null;
    else{
      const match=source.match(/(?:^|\s)в\s+([01]?\d|2[0-3])(?:\s+(?:час(?:а|ов)?|утра|дня|вечера|ночи)|\s*$)/);
      if(!match)return null;
      const clock=clockContext(source,match);if(clock.ambiguous)return null;hour=clock.hour;minute=0;
    }
    const base=days[0][0]==='сегодня'?0:days[0][0]==='завтра'?1:2;
    const total=base*1440+hour*60+minute+offsetMinutes;
    const day=Math.floor(total/1440),clock=((total%1440)+1440)%1440;
    const time=String(Math.floor(clock/60)).padStart(2,'0')+':'+String(clock%60).padStart(2,'0');
    const label=day===0?'сегодня':day===1?'завтра':day===2?'послезавтра':day===-1?'вчера':day>0?'через '+day+' дней':Math.abs(day)+' дней назад';
    return {day_offset:day,time,label:label+' в '+time,reference:'conversation_day',calendar_date_known:false};
  }
  function relativeSchedule(resolution){
    if(!resolution||resolution.status==='not_applicable')return {event:null,contact:null};
    const anchor=resolution.event_anchor;
    return anchor?{event:relativeTime(anchor.raw_time_expression),contact:relativeTime(anchor.raw_time_expression,anchor.offset_minutes)}
      :{event:null,contact:relativeTime(resolution.raw_time_expression)};
  }
  async function checkVersion(fetcher=fetch){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
    try{
      const response=await fetcher('/ai-application-attributes-runtime.json',{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error('VERSION_CHECK_UNAVAILABLE');
      const manifest=await response.json();
      if(!Number.isInteger(manifest.revision))throw new Error('VERSION_CHECK_UNAVAILABLE');
      return {current:manifest.revision===revision,loaded_revision:revision,available_revision:manifest.revision};
    }finally{clearTimeout(timer);}
  }
  window.ApplicationAttributesRuntime={revision,clockContext,relativeTime,relativeSchedule,checkVersion};
})();
