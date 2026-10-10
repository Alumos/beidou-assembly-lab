(function (root, factory) {
  const common = typeof module === 'object' && module.exports;
  const api = factory(common ? require('./engine.js') : root.BeidouEngine, common ? require('./scene.js') : root.BeidouScene, common ? require('./clock-model.js') : root.BeidouClockModel);
  if (common) module.exports = api; else root.BeidouClockScene = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E, S, M) {
  'use strict';
  const FONT = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
  const SUBJECTS = {
    car: { name:'车辆', x:270, y:548, w:232, h:182, color:'#228690' },
    ship: { name:'航船', x:700, y:556, w:260, h:204, color:'#228690' },
    phone: { name:'手机', x:1035, y:549, w:146, h:162, color:'#228690' },
  };
  let textScale = 1;
  const rand = i => { const t = Math.sin(i * 129.23 + 92.3) * 17391.78; return t - Math.floor(t); };
  const blend = (a,b,t) => a+(b-a)*t;
  function txt(c,value,x,y,size=15,color='#385e7a',align='left',weight=400) { size=Math.max(size,14/textScale); c.font=`${weight} ${size}px ${FONT}`;c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(value,x,y); }
  function ln(c,x,y,x2,y2,color='rgba(43,125,135,0.361)',w=1) { c.strokeStyle=color;c.lineWidth=w;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke(); }
  function poly(c,points,fill,stroke) { c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();} }
  function sprite(c,image,x,y,w,h,alpha=1) { if(!image)return;c.save();c.globalAlpha*=alpha;c.drawImage(image,x-w/2,y-h/2,w,h);c.restore(); }
  function pill(c,label,x,y,color,size=12) { size=Math.max(size,14/textScale); c.font=`400 ${size}px ${FONT}`;const w=c.measureText(label).width+18,h=size+12;c.fillStyle='rgba(239,246,250,0.863)';c.strokeStyle=color;c.lineWidth=1;S.roundedPath(c,x,y-h/2,w,h,6);c.fill();c.stroke();txt(c,label,x+9,y,size,color); }
  function makeGhosts(assets, createCanvas) {
    const ghosts={};
    E.PARTS.filter(p=>p.group==='user').forEach(p=>{ const canvas=createCanvas(420,330),c=canvas.getContext('2d');c.drawImage(assets[p.file],0,0,420,330);c.globalCompositeOperation='source-atop';c.globalAlpha=.62;c.fillStyle='#9a5d19';c.fillRect(0,0,420,330);ghosts[p.id]=canvas; });
    return ghosts;
  }
  function layout(width,height,target='ship') {
    const mobile=width<620,W=mobile?720:1200,H=mobile?960:750,s=Math.min(width/W,height/H);
    return {mobile,W,H,s,ox:(width-W*s)/2,oy:(height-H*s)/2,target};
  }
  function draw(ctx, opts) {
    const {width,height,state,assets,earth,ghosts={},time=0,ns=0,target='ship',progress=1,fromFocus='all',fromTime=0,reducedMotion=false}=opts;
    const L=layout(width,height,target), {mobile,W,H,s,ox,oy}=L;
    textScale=s;
    const u=M.ease(progress), visibility=M.ease(Math.min(1,progress/0.65));
    if(progress<1) S.draw(ctx,Object.assign({},opts,{focus:fromFocus,time:fromTime,selected:null,hovered:null})); else ctx.clearRect(0,0,width,height);
    ctx.save();ctx.translate(ox,oy);ctx.scale(s,s);
    ctx.save();ctx.globalAlpha=visibility;
    const sky=ctx.createLinearGradient(0,0,W,H);sky.addColorStop(0,'#eff5fa');sky.addColorStop(.52,'#eff6fa');sky.addColorStop(1,'#eff6fa');ctx.fillStyle=sky;ctx.fillRect(-ox/s,-oy/s,width/s,height/s);
    const haze=ctx.createRadialGradient(mobile?390:560,240,10,mobile?390:560,240,520);haze.addColorStop(0,'rgba(59,144,171,0.141)');haze.addColorStop(1,'rgba(59,144,171,0.000)');ctx.fillStyle=haze;ctx.fillRect(0,0,W,H);
    for(let i=0;i<150;i++){ctx.fillStyle=`rgba(207,237,246,${.13+rand(i+130)*.55})`;ctx.beginPath();ctx.arc(rand(i)*W,rand(i+60)*(mobile?490:378),rand(i+321)*1.2+.35,0,Math.PI*2);ctx.fill();}
    const earthX=mobile?594:1039,earthY=mobile?132:149,earthR=mobile?84:98;
    const glow=ctx.createRadialGradient(earthX,earthY,earthR*.8,earthX,earthY,earthR*1.2);glow.addColorStop(0,'rgba(25,121,154,0.102)');glow.addColorStop(1,'rgba(25,121,154,0.000)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(earthX,earthY,earthR*1.2,0,Math.PI*2);ctx.fill();
    if(earth)ctx.drawImage(earth,earthX-earthR,earthY-earthR,earthR*2,earthR*2);
    ctx.strokeStyle='rgba(75,142,155,0.231)';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(earthX,earthY,earthR*1.6,earthR*.55,-.4,0,Math.PI*2);ctx.stroke();
    const groundTop=mobile?515:394;
    const water=ctx.createLinearGradient(0,groundTop,0,H);water.addColorStop(0,'#c9e2ee');water.addColorStop(1,'#eff6fa');
    poly(ctx,[[0,groundTop+32],[W,groundTop-16],[W,H],[0,H]],water);
    for(let i=0;i<19;i++){const y=groundTop+58+i*(mobile?18:15);ln(ctx,0,y,W,y-41,'rgba(75,137,155,0.137)');}
    if(!mobile){
      poly(ctx,[[16,499],[328,458],[485,592],[118,677]],'#d1dee5','rgba(75,125,155,0.333)');
      poly(ctx,[[44,513],[323,474],[430,573],[132,645]],'#4b779b','rgba(75,142,155,0.333)');
      ctx.save();ctx.setLineDash([17,18]);ln(ctx,78,542,373,549,'rgba(58,120,117,0.443)',2);ctx.restore();
      poly(ctx,[[906,478],[1127,450],[1196,541],[940,610]],'#cee0e9','rgba(75,131,155,0.333)');
      for(let i=0;i<7;i++)ln(ctx,935+i*30,482-i*3,967+i*31,577-i*7,'rgba(75,135,155,0.200)');
      ln(ctx,522,485,570,635,'#4b8a9b',5);ln(ctx,534,484,582,633,'#ccdfea',9);
    }else{
      poly(ctx,[[55,613],[472,542],[674,700],[190,821]],'#d0dee7','rgba(75,128,155,0.333)');
      if(target==='car'){poly(ctx,[[64,636],[462,570],[619,702],[185,788]],'#4b799b','rgba(58,97,120,0.400)');ctx.save();ctx.setLineDash([18,17]);ln(ctx,117,683,521,649,'rgba(58,120,120,0.569)',2);ctx.restore();}
      if(target==='ship'){ctx.fillStyle='#c9e3ee';ctx.fillRect(0,597,W,H-597);for(let i=0;i<13;i++)ln(ctx,60,627+i*23,660,606+i*23,'rgba(75,136,155,0.188)');}
    }
    const fontSmall=Math.max(16,13/s),fontLabel=Math.max(20,15/s);
    txt(ctx,'空间段',mobile?40:54,mobile?65:61,fontLabel,'#2a7888','left',500);
    if(!mobile)txt(ctx,'一颗卫星存在未校正钟差',54,86,13,'#4b7e9b');
    txt(ctx,'用户端',mobile?40:54,groundTop+13,fontLabel,'#2a7888','left',500);
    if(!mobile){txt(ctx,'实体位置保持不变，观察导航估计位置如何偏移',54,groundTop+37,13,'#3a6478');ctx.fillStyle='#20928d';ctx.beginPath();ctx.arc(824,409,4,0,Math.PI*2);ctx.fill();txt(ctx,'实体位置',836,409,12,'#34757f');ctx.fillStyle='#995b1a';ctx.beginPath();ctx.arc(969,409,4,0,Math.PI*2);ctx.fill();txt(ctx,'导航估计位置',981,409,12,'#825d31');}
    else txt(ctx,`${SUBJECTS[target].name} · 实体与估计位置对照`,40,groundTop+47,fontSmall,'#3a6378');
    ctx.restore();
    ctx.globalAlpha=u;
    const satellite={x:mobile?226:291,y:mobile?205:194,w:mobile?350:430,h:mobile?276:338};
    // The main satellite travels from its real scene location into the close-up.
    const oldCam=S.camera(width,height,fromFocus), geo=E.PARTS.find(p=>p.id==='geo'),oldPos=E.position(geo,fromTime,true,state.missionTime);
    const oldX=(oldPos.x*oldCam.scale+oldCam.x-ox)/s,oldY=(oldPos.y*oldCam.scale+oldCam.y-oy)/s;
    const sx=blend(oldX,satellite.x,u),sy=blend(oldY,satellite.y,u),sw=blend(geo.w*oldCam.scale/s,satellite.w,u),sh=blend(geo.h*oldCam.scale/s,satellite.h,u);
    sprite(ctx,assets[geo.file],sx,sy,sw,sh);
    const clockX=mobile?416:442,clockY=mobile?297:277,clockW=mobile?123:131;
    ctx.save();ctx.shadowColor=ns>0?'#9a5c19':'#218691';ctx.shadowBlur=16+Math.min(20,ns/30);sprite(ctx,assets.clock,clockX,clockY,clockW,clockW*.78);ctx.restore();
    ln(ctx,satellite.x+22,satellite.y+24,clockX-32,clockY-17,ns>0?'rgba(144,90,35,0.533)':'rgba(45,120,134,0.478)');
    ctx.strokeStyle=ns>0?'rgba(147,101,32,0.486)':'rgba(38,127,140,0.353)';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(clockX,clockY,clockW*.59,clockW*.35,0,0,Math.PI*2);ctx.stroke();
    txt(ctx,'原子钟 · 时间基准',clockX,mobile?369:344,fontSmall,ns>0?'#94641f':'#317b81','center');
    const healthy=mobile?[[468,90],[658,288],[518,388]]:[[871,94],[1150,248],[845,273]];
    healthy.forEach(([x,y],i)=>sprite(ctx,assets[E.PARTS[i].file],x,y,mobile?83:90,mobile?65:71,.78));
    // Synchronized tick lanes make the phase difference visible without claiming to show RF frequency.
    const tickX=mobile?56:560,tickY=mobile?433:209,tickW=mobile?605:251;
    if(!mobile)txt(ctx,'把纳秒级时间差放大来看',tickX,tickY-45,13,'#3a6378');
    ['参考时间','卫星时间'].forEach((label,row)=>{
      const y=tickY+row*(mobile?41:53),shift=row?ns/600*32:0;
      txt(ctx,label,tickX,y-13,fontSmall,row&&ns>0?'#8f6523':'#336c80');
      const baselineX=tickX+(mobile?125:0),baselineY=mobile?y-13:y+8,visibleW=mobile?tickW-260:tickW;
      ln(ctx,baselineX,baselineY,baselineX+visibleW,baselineY,'rgba(75,128,155,0.467)');
      ctx.save();ctx.beginPath();ctx.rect(baselineX,baselineY-16,visibleW,25);ctx.clip();
      for(let i=-1;i<8;i++){const px=baselineX+i*48+(reducedMotion?0:time*16%48)+shift;ln(ctx,px,baselineY-9,px,baselineY+6,row&&ns>0?'#9a5e19':'#228c91',2);}
      ctx.restore();
      if(mobile)txt(ctx,row?`+${Math.round(ns)} ns`:'±0 ns',tickX+tickW,y-13,fontSmall,row&&ns>0?'#9a6219':'#268c8b','right');
      else txt(ctx,row?`+${Math.round(ns)} ns`:'±0 ns',tickX+tickW,y-13,13,row&&ns>0?'#9a6219':'#268c8b','right');
    });
    const displayed=mobile?[target]:['car','ship','phone'];
    displayed.forEach(id=>{
      const p=E.PARTS.find(p=>p.id===id),base=SUBJECTS[id],active=id===target;
      const actual=mobile?{x:425,y:674,w:id==='phone'?190:324,h:id==='phone'?214:255}:base;
      const response=M.response(ns,id),pixelsPerMeter=mobile?2.12:1.6;
      const dx=response.east*pixelsPerMeter,dy=-response.north*pixelsPerMeter*.57;
      const estimated={x:actual.x+dx,y:actual.y+dy};
      const groundOffset=actual.h*.30,anchorY=actual.y+groundOffset;
      const oldPart=E.position(p,fromTime,true,state.missionTime);
      const ax=blend((oldPart.x*oldCam.scale+oldCam.x-ox)/s,actual.x,u),ay=blend((oldPart.y*oldCam.scale+oldCam.y-oy)/s,actual.y,u);
      const aw=blend(p.w*oldCam.scale/s,actual.w,u),ah=blend(p.h*oldCam.scale/s,actual.h,u);
      // Pulses from the faulted satellite remain visibly one-way toward the receiver.
      const beamColor=ns>.1?'#995e19':'#1f8194';
      ctx.save(); ctx.globalAlpha = u * (active ? 1 : .45);
      S.drawPacket(ctx, {x:satellite.x,y:satellite.y+99}, {x:actual.x,y:anchorY}, beamColor, time, id==='car'?0:id==='ship'?1:2);
      ctx.restore();
      // Show actual entity, its fixed reference marker, and a displaced translucent estimate.
      sprite(ctx,assets[p.file],ax,ay,aw,ah,active?1:.72);
      ctx.save();ctx.globalAlpha=u*(active?1:.6);ctx.strokeStyle='#238f89';ctx.lineWidth=1.7;ctx.beginPath();ctx.ellipse(actual.x,anchorY,17,6,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#1f9389';ctx.beginPath();ctx.arc(actual.x,anchorY,3,0,Math.PI*2);ctx.fill();ctx.restore();
      if(response.errorMeters>.3){
        ctx.save();ctx.globalAlpha=u*(active?.52:.27);ctx.shadowColor='#936020';ctx.shadowBlur=active?17:8;sprite(ctx,ghosts[id]||assets[p.file],estimated.x,estimated.y,actual.w,actual.h);ctx.restore();
        const ex=estimated.x,ey=estimated.y+groundOffset;
        ctx.save();ctx.globalAlpha=u*(active?1:.5);ctx.setLineDash([4,5]);ln(ctx,actual.x,anchorY,ex,ey,'#995c19',1.5);ctx.setLineDash([]);
        ctx.strokeStyle='#9a5e19';ctx.lineWidth=1.6;ctx.beginPath();ctx.ellipse(ex,ey,17,6,0,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle='#9a5e19';ctx.beginPath();ctx.arc(ex,ey,3.5,0,Math.PI*2);ctx.fill();
        if(response.errorMeters>5){const theta=Math.atan2(ey-anchorY,ex-actual.x);ctx.translate(ex,ey);ctx.rotate(theta);poly(ctx,[[0,0],[-8,-3],[-8,3]],'#9a5e19');}
        ctx.restore();
        if(active&&response.errorMeters>12){pill(ctx,'实际位置',actual.x+13,anchorY-13,'#268c86',fontSmall);pill(ctx,'导航估计位置',ex-77,ey+28,'#996219',fontSmall);}
      }else if(active)pill(ctx,'实际位置与估计位置重合',actual.x-(mobile?144:102),anchorY+32,'#268c86',fontSmall);
      const captionY=mobile?930:720;
      txt(ctx,`${base.name} · 偏差 ${response.errorMeters.toFixed(1)} 米`,mobile?360:actual.x,captionY,Math.max(18,14/s),active?'#96651c':'#3a6578','center',active?500:400);
    });
    if(mobile){ctx.fillStyle='#288a85';ctx.beginPath();ctx.arc(58,884,5,0,Math.PI*2);ctx.fill();txt(ctx,'实体位置',72,884,fontSmall,'#386f7a');ctx.fillStyle='#98601b';ctx.beginPath();ctx.arc(334,884,5,0,Math.PI*2);ctx.fill();txt(ctx,'导航估计位置',348,884,fontSmall,'#8a6329');}
    // A single moving light veil masks the handoff between wide scene and close-up.
    if(progress>0&&progress<1&&!reducedMotion){ctx.save();ctx.globalAlpha=Math.sin(progress*Math.PI)*.20;const center=-W*.3+progress*W*1.6,veil=ctx.createLinearGradient(center-180,0,center+180,0);veil.addColorStop(0,'rgba(25,136,154,0.000)');veil.addColorStop(.5,'#1a9991');veil.addColorStop(1,'rgba(25,136,154,0.000)');ctx.fillStyle=veil;ctx.fillRect(center-180,0,360,H);ctx.restore();}
    ctx.restore();return L;
  }
  return {draw,layout,makeGhosts,SUBJECTS};
});
