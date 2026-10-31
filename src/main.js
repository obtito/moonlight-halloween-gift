import './style.css';
import './show.css';
import { createWorld } from './world.js';
import { createModelSlot } from './model-slot.js';
import { createChoreography, specs } from './choreography.js';
import { giftConfig } from './gift-config.js';
import { createEntrance } from './entrance.js';
import { CINEMATIC_DURATION } from './cinematic-camera.js';
import { createPerformance } from './performance.js';
import { t, getLanguage, initI18n, onLanguageChange } from './i18n.js';

const $ = id => document.getElementById(id);
initI18n();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const choreography = createChoreography();
const entrance = createEntrance({ duration: CINEMATIC_DURATION, reducedMotion });
const stageShow = createPerformance({ reducedMotion, duration: 18, beats: 20 });
let completedShowRun = 0, showChapter = '';
let cinematicChapter = -1;
let cardDissolveRadius = 1;
let world = null, modelSlot = null, toastTimeout, opened = false, editor = false, elapsed = 0;
let frameHandle = 0, previousTime = 0, disposed = false;
let toastCopy = null, lastModelInfo = null, modelLoading = false, modelSignature = '';
let fallbackNote = null;
let nextPumpkin = 0;
const storageKey = 'moonlight-dance'; // Reuse the prototype's local choreography storage.
function toast(key, params = {}) {
  toastCopy = { key, params };
  $('toast').textContent = t(key, params);
  $('toast').classList.add('visible');
  clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 3600);
}
function toastError(error, fallback = 'dynamic.modelLoadFailed') {
  toast(error?.i18nKey || fallback, error?.i18nParams || {});
}
function openLetter() {
  if (stageShow.state.active) cancelShow();

  if (!opened || entrance.state.phase === 'running') finishEntrance();
  if (!$('letter-dialog').open) $('letter-dialog').showModal();
}
try {
  world = createWorld($('scene-container'), { reducedMotion, onPumpkin: playPumpkin });
  modelSlot = createModelSlot(world.modelRoot, { onChange: info => {
    world.setModelLoaded(info.loaded); renderModelInfo(info);
  } });
  renderModelInfo(modelSlot.getInfo());
} catch (error) {
  console.error('Unable to initialize the 3D stage:', error);
  $('scene-container').classList.add('render-fallback');
  fallbackNote = document.createElement('p'); fallbackNote.setAttribute('role', 'alert');
  fallbackNote.textContent = t('dynamic.fallbackBody');
  $('scene-container').append(fallbackNote);
}
function renderGiftCopy() {
  const copy = giftConfig.locales[getLanguage()] || giftConfig.locales.ja;
  const title = document.querySelector('.hero-copy h1');
  if (title) title.replaceChildren(...copy.title.split('\n').flatMap((line, index) => index ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
  const recipient = document.querySelector('[data-recipient]');
  if (recipient) recipient.textContent = copy.recipient;
  const invitationRecipient = document.querySelector('[data-invitation-recipient]');
  if (invitationRecipient) invitationRecipient.textContent = copy.invitationRecipient;
  const revealRecipient = document.querySelector('[data-reveal-recipient]');
  if (revealRecipient) revealRecipient.textContent = copy.invitationRecipient;
  const letterBody = document.querySelector('[data-letter-body]');
  if (letterBody) {
    letterBody.replaceChildren();
    let paragraph = document.createElement('p'); letterBody.append(paragraph);
    for (const line of copy.letter) {
      if (!line) { paragraph = document.createElement('p'); letterBody.append(paragraph); }
      else { if (paragraph.childNodes.length) paragraph.append(document.createElement('br')); paragraph.append(document.createTextNode(line)); }
    }
  }
}
function renderExperienceCopy() {
  const running = entrance.state.phase === 'running';
  const show = stageShow.state;
  $('invite-label').textContent = t(running ? 'dynamic.inviteRunning' : opened ? 'dynamic.inviteReplay' : 'dynamic.inviteOpen');
  $('invite-button').disabled = running || show.active;
  $('show-label').textContent = t(show.active ? 'show.playing' : show.phase === 'complete' ? 'show.replay' : 'show.start');
  $('show-button').disabled = !opened || running || show.active || editor;
  $('pumpkin-secret').disabled = !opened || running || show.active || editor;
  $('open-letter').disabled = !opened || running || show.active;
  $('hero-note').textContent = t(running ? 'dynamic.heroNoteRunning' : show.active ? 'show.notePlaying' : opened ? show.phase === 'complete' ? 'show.noteComplete' : 'show.noteReady' : 'dynamic.heroNoteIdle');
}
function presentShow() {
  const state = stageShow.state;
  world?.setPerformance?.(state);
  $('show-progress').value = state.progress;
  if (state.chapter !== showChapter) {
    showChapter = state.chapter;
    if (['warmup', 'dance', 'finale'].includes(showChapter)) $('show-status').textContent = t(`show.${showChapter}`);
    renderExperienceCopy();
  }
}
function cancelShow() {
  stageShow.cancel();
  world?.setPerformance?.(stageShow.state);
  document.body.classList.remove('show-running');
  $('show-tools').hidden = true;
  showChapter = '';
  renderExperienceCopy();
}
function completeShow() {
  const state = stageShow.state;
  if (state.phase !== 'complete' || completedShowRun === state.runId) return;
  completedShowRun = state.runId;
  world?.setPerformance?.(state);
  document.body.classList.remove('show-running');
  $('show-tools').hidden = true;
  renderExperienceCopy();
  if (!editor && !$('letter-dialog').open) $('show-button').focus({ preventScroll: true });
}
function startShow() {
  if (!opened || entrance.state.phase === 'running' || stageShow.state.active) return;
  if (editor) setEditor(false);
  if (!stageShow.begin()) return;

  document.body.classList.add('show-running');
  $('show-tools').hidden = false;
  showChapter = ''; presentShow();
  if (!world) stageShow.finish();
  if (stageShow.state.phase === 'complete') completeShow();
  else $('skip-show').focus({ preventScroll: true });
}
function playPumpkin(index = 0) {
  if (!opened || editor || stageShow.state.active || entrance.state.phase === 'running' || $('letter-dialog').open) return;
  world?.playPumpkinInteraction?.(index);
}
function restoreStageFocus() {
  renderExperienceCopy();
  if (!disposed && opened && !editor && !stageShow.state.active && entrance.state.phase !== 'running' && !$('letter-dialog').open) {
    $('show-button').focus({ preventScroll: true });
  }
}
renderGiftCopy();
function finishEntrance({ focus = false, playFireworks = false } = {}) {
  entrance.finish(); opened = true;
  world?.setEntranceProgress(1);
  document.body.classList.remove('reveal-running');
  document.body.classList.add('invited');
  $('scene-container').removeAttribute('aria-hidden');
  $('experience').style.removeProperty('--card-dissolve');
  $('entrance-tools').hidden = true;
  $('invitation-mount').inert = true;
  $('invitation-mount').setAttribute('aria-hidden', 'true');
  $('invite-button').disabled = false;
  $('invite-label').textContent = t('dynamic.inviteReplay');
  $('open-letter').disabled = false;
  renderExperienceCopy();
  if (playFireworks && !editor && !$('letter-dialog').open) startShow();
  else if (focus && !$('letter-dialog').open && !editor) $('show-button').focus({ preventScroll: true });
}
function enterStage(event) {
  if (!entrance.begin()) return;
  cancelShow();

  if (editor) setEditor(false);
  choreography.stop();
  // Capture the paper's screen footprint before the cinematic layout fades out.
  const paper = $('invitation-card'), paperBounds = paper.getBoundingClientRect();
  const sceneBounds = $('scene-container').getBoundingClientRect();
  const paperMatrix = new DOMMatrixReadOnly(getComputedStyle(paper).transform);
  let clickX = .5, clickY = .5;
  if (event?.currentTarget === paper && event.detail > 0) {
    // Bounding-box centring already accounts for hover translation.
    const linearMatrix = new DOMMatrixReadOnly([paperMatrix.a, paperMatrix.b, paperMatrix.c, paperMatrix.d, 0, 0]);
    const local = linearMatrix.inverse().transformPoint(new DOMPoint(
      event.clientX - paperBounds.left - paperBounds.width / 2,
      event.clientY - paperBounds.top - paperBounds.height / 2,
    ));
    clickX = Math.max(0, Math.min(1, .5 + local.x / paper.offsetWidth));
    clickY = Math.max(0, Math.min(1, .5 + local.y / paper.offsetHeight));
  }
  cardDissolveRadius = Math.hypot(
    Math.max(clickX, 1 - clickX) * paper.offsetWidth,
    Math.max(clickY, 1 - clickY) * paper.offsetHeight,
  ) + 20;
  paper.style.setProperty('--dissolve-origin-x', `${clickX * 100}%`);
  paper.style.setProperty('--dissolve-origin-y', `${clickY * 100}%`);
  const cardSource = {
    centerX: (paperBounds.left + paperBounds.width / 2 - sceneBounds.left) / Math.max(1, sceneBounds.width),
    centerY: (paperBounds.top + paperBounds.height / 2 - sceneBounds.top) / Math.max(1, sceneBounds.height),
    width: paper.offsetWidth / Math.max(1, sceneBounds.width),
    height: paper.offsetHeight / Math.max(1, sceneBounds.height),
    roll: -Math.atan2(paperMatrix.b, paperMatrix.a),
    originX: clickX, originY: 1 - clickY,
  };
  paper.style.setProperty('--paper-rotation', `${-cardSource.roll}rad`);
  paper.style.setProperty('--paper-transform', getComputedStyle(paper).transform);
  document.body.classList.remove('invited');
  document.body.classList.add('reveal-running');
  $('scene-container').setAttribute('aria-hidden', 'true');
  $('invitation-mount').inert = true;
  $('invitation-mount').setAttribute('aria-hidden', 'true');
  $('invite-button').disabled = true;
  $('invite-label').textContent = t('dynamic.inviteRunning');
  $('open-letter').disabled = true;
  $('entrance-tools').hidden = reducedMotion;
  renderExperienceCopy();
  cinematicChapter = -1; updateCinematicPresentation(0);
  world?.beginEntrance(cardSource);
  if (entrance.state.phase === 'complete') finishEntrance({ focus: true, playFireworks: true });
  else $('skip-entrance').focus({ preventScroll: true });
}
function updateCinematicPresentation(progress) {
  const clamp = value => Math.max(0, Math.min(1, value));
  $('experience').style.setProperty('--card-dissolve', String(clamp(progress / .22)));
  $('experience').style.setProperty('--dissolve-radius', `${clamp(progress / .22) * cardDissolveRadius}px`);
  const chapter = progress < .22 ? 0 : progress < .57 ? 1 : 2;
  if (chapter === cinematicChapter) return;
  cinematicChapter = chapter;
  $('cinematic-line').textContent = t(`dynamic.cinematic${chapter}Line`);
  $('cinematic-translation').textContent = t(`dynamic.cinematic${chapter}Sub`);
  $('entrance-status').textContent = t(`dynamic.cinematic${chapter}Status`);
}
$('invite-button').addEventListener('click', enterStage);
$('invitation-card').addEventListener('click', enterStage);
$('skip-entrance').addEventListener('click', () => finishEntrance({ focus: true, playFireworks: true }));
$('show-button').addEventListener('click', startShow);
$('skip-show').addEventListener('click', () => { stageShow.finish(); completeShow(); });
$('pumpkin-secret').addEventListener('click', () => {
  playPumpkin(nextPumpkin);
  nextPumpkin = (nextPumpkin + 1) % (world?.pumpkinCount || 7);
});
$('open-letter').addEventListener('click', openLetter);
$('letter-tab').addEventListener('click', openLetter);
$('stage-tab').addEventListener('click', () => { $('letter-dialog').close(); renderExperienceCopy(); $('experience').scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' }); });
$('close-letter').addEventListener('click', () => $('letter-dialog').close());
$('letter-dialog').addEventListener('close', restoreStageFocus);
$('letter-dialog').addEventListener('click', e => { if (e.target === $('letter-dialog')) { const r = $('letter-dialog').getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('letter-dialog').close(); } });
$('replay-button').addEventListener('click', () => { $('letter-dialog').close(); startShow(); });
function setEditor(value) {
  if (value) {
    if (stageShow.state.active) cancelShow();

  }
  if (value && entrance.state.phase === 'running') finishEntrance();
  editor = value; document.body.classList.toggle('studio-open', value);
  $('scene-container').setAttribute('aria-hidden', String(!value && !opened));
  $('studio-panel').hidden = !value; $('timeline-panel').hidden = !value;
  $('studio-toggle').setAttribute('aria-expanded', String(value));
  world?.setEditing(value);
  renderExperienceCopy();
  if (value) $('studio-close').focus(); else $('studio-toggle').focus();
}
$('studio-toggle').addEventListener('click', () => setEditor(!editor));
$('studio-close').addEventListener('click', () => setEditor(false));
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (stageShow.state.active) { cancelShow(); $('show-button').focus({ preventScroll: true }); }
  else if (editor && !$('letter-dialog').open) setEditor(false);
});

for (const spec of specs) {
  const row = document.createElement('div'); row.className = 'joint-control';
  const labelRow = document.createElement('div'); labelRow.className = 'joint-label';
  const label = document.createElement('label'); label.htmlFor = `joint-${spec.key}`; label.textContent = t(`dynamic.joint.${spec.key}`);
  const output = document.createElement('output'); output.id = `value-${spec.key}`; output.textContent = '0°';
  labelRow.append(label, output);
  const input = document.createElement('input'); input.type = 'range'; input.id = `joint-${spec.key}`;
  input.min = spec.min; input.max = spec.max; input.step = 1; input.value = 0;
  input.addEventListener('input', () => choreography.setJoint(spec.key, input.value));
  row.append(labelRow, input); $('joint-controls').append(row);
}
let framesSignature = '';
function renderChoreography(state) {
  modelSlot?.setPose(state.pose);
  for (const { key } of specs) {
    if ($(`joint-${key}`)) $(`joint-${key}`).value = state.pose[key];
    if ($(`value-${key}`)) $(`value-${key}`).textContent = `${Math.round(state.pose[key])}°`;
  }
  const signature = JSON.stringify([getLanguage(), state.frames, state.selected, state.duration]);
  if (signature !== framesSignature) {
    framesSignature = signature; $('frames').replaceChildren();
    if (!state.frames.length) { const empty = document.createElement('p'); empty.className = 'empty-frames'; empty.textContent = t('dynamic.emptyFrames'); $('frames').append(empty); }
    state.frames.forEach((pose, index) => {
      const button = document.createElement('button'); button.className = 'frame' + (state.selected === index ? ' active' : '');
      button.type = 'button'; button.setAttribute('aria-label', t('dynamic.frameSelect', { number: index + 1 })); button.setAttribute('aria-pressed', String(state.selected === index));
      const number = document.createElement('span'); number.textContent = String(index + 1).padStart(2, '0');
      const name = document.createElement('strong'); name.textContent = t('dynamic.pose');
      const time = document.createElement('small'); time.textContent = t('dynamic.frameTime', { value: (index * state.duration).toFixed(1) });
      button.append(number, name, time); button.addEventListener('click', () => choreography.selectFrame(index)); $('frames').append(button);
    });
  }
  $('frame-count').textContent = t('dynamic.frameCount', { count: state.frames.length });
  $('play-button').textContent = t(state.playing ? 'dynamic.pause' : 'dynamic.play');
  $('play-button').setAttribute('aria-label', t(state.playing ? 'dynamic.pauseAria' : 'dynamic.playAria'));
  $('play-button').disabled = state.frames.length < 2;
  $('delete-frame').disabled = state.selected < 0;
  $('add-frame').disabled = state.frames.length >= 200;
  $('scrubber').max = state.totalDuration || 1;
  $('scrubber').value = state.time;
  $('scrubber').disabled = state.frames.length < 2;
  $('time-readout').textContent = t('dynamic.timeReadout', { current: state.time.toFixed(1), total: state.totalDuration.toFixed(1) });
  $('duration').value = state.duration; $('duration-value').textContent = t('dynamic.durationValue', { value: state.duration.toFixed(1) });
  $('speed').value = state.speed; $('speed-value').textContent = `${state.speed.toFixed(2).replace(/0$/, '')}×`;
  $('loop').checked = state.loop;
}
choreography.subscribe(renderChoreography);
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => choreography.applyPreset(button.dataset.preset)));
$('reset-pose').addEventListener('click', () => choreography.resetPose());
$('add-frame').addEventListener('click', () => choreography.addFrame());
$('delete-frame').addEventListener('click', () => choreography.deleteFrame(choreography.state.selected));
$('clear-frames').addEventListener('click', () => choreography.clear());
$('demo-frames').addEventListener('click', () => { choreography.loadDemo(); toast('dynamic.demoLoaded'); });
$('play-button').addEventListener('click', () => { choreography.togglePlayback(); if (!modelSlot?.getInfo().loaded) toast('dynamic.playNeedsModel'); });
$('stop-button').addEventListener('click', () => choreography.stop());
$('scrubber').addEventListener('input', e => { if (choreography.state.playing) choreography.togglePlayback(); choreography.seek(e.target.value); });
$('duration').addEventListener('input', e => choreography.setDuration(e.target.value));
$('speed').addEventListener('input', e => choreography.setSpeed(e.target.value));
$('loop').addEventListener('change', e => choreography.setLoop(e.target.checked));
$('save-dance').addEventListener('click', () => { try { localStorage.setItem(storageKey, choreography.serialize()); toast('dynamic.danceSaved'); } catch { toast('dynamic.danceSaveUnavailable'); } });
function download(url, name) { const link = document.createElement('a'); link.href = url; link.download = name; link.click(); }
$('export-dance').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([choreography.serialize()], { type: 'application/json' })); download(url, 'moonlight-dance.json'); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('dynamic.danceExported'); });
$('import-dance').addEventListener('click', () => $('dance-file').click());
$('dance-file').addEventListener('change', async e => {
  const file = e.target.files?.[0]; if (!file) return;
  try { if (file.size > 1024 * 1024) throw new Error('too large'); choreography.load(await file.text()); toast('dynamic.danceImported'); }
  catch { toast('dynamic.invalidDance'); }
  e.target.value = '';
});
try { const saved = localStorage.getItem(storageKey); if (saved) choreography.load(saved); } catch { toast('dynamic.restoreFailed'); }

function boneDisplayName(name) {
  const unnamed = /^未命名骨骼 (\d+)$/.exec(name);
  return unnamed ? t('dynamic.unnamedBone', { number: unnamed[1] }) : name;
}
function renderModelInfo(info) {
  lastModelInfo = info;
  const modelName = info.name === '远程模型' ? t('dynamic.remoteModel') : info.name;
  $('model-status').textContent = modelLoading ? t('dynamic.modelLoading') : info.loaded
    ? t('dynamic.modelStatus', { name: modelName, bones: info.bones.length, mapped: info.mappedCount })
    : t('dynamic.modelReserved');
  $('clear-model').disabled = !info.loaded;
  const signature = JSON.stringify([info.loaded, info.bones]);
  if (signature !== modelSignature) {
    modelSignature = signature; $('joint-map').replaceChildren();
    const hint = document.createElement('p'); hint.className = 'panel-note'; $('joint-map').append(hint);
    if (info.loaded) for (const { key } of specs) {
      const wrap = document.createElement('label'); wrap.className = 'mapping-row'; wrap.dataset.joint = key;
      const label = document.createElement('span'); wrap.append(label);
      const select = document.createElement('select'); select.dataset.joint = key;
      const none = document.createElement('option'); none.value = ''; select.append(none);
      for (const name of info.bones) { const option = document.createElement('option'); option.value = name; select.append(option); }
      select.addEventListener('change', () => {
        try { modelSlot?.setMapping(key, select.value); modelSlot?.setPose(choreography.state.pose); }
        catch (error) { select.value = modelSlot?.getInfo().mapping[key] || ''; toastError(error); }
      });
      wrap.append(select); $('joint-map').append(wrap);
    }
  }
  const hint = $('joint-map').querySelector('.panel-note');
  if (hint) hint.textContent = t(!info.loaded ? 'dynamic.modelMapEmpty' : info.bones.length ? 'dynamic.modelRigHint' : 'dynamic.modelStaticHint');
  if (info.loaded) for (const { key } of specs) {
    const wrap = $('joint-map').querySelector(`.mapping-row[data-joint="${key}"]`);
    if (!wrap) continue;
    const joint = t(`dynamic.joint.${key}`);
    wrap.querySelector('span').textContent = joint;
    const select = wrap.querySelector('select');
    select.setAttribute('aria-label', t('dynamic.mappingAria', { joint }));
    select.options[0].textContent = t(key === 'body' ? 'dynamic.wholeModel' : 'dynamic.unmapped');
    for (let index = 1; index < select.options.length; index++) select.options[index].textContent = boneDisplayName(select.options[index].value);
    select.value = info.mapping[key] || '';
  }
}
$('load-model').addEventListener('click', () => $('model-file').click());
$('model-file').addEventListener('change', async e => {
  const file = e.target.files?.[0]; if (!file || !modelSlot) return;
  modelLoading = true; $('model-status').textContent = t('dynamic.modelLoading'); $('load-model').disabled = true;
  try { await modelSlot.loadFile(file); modelSlot.setPose(choreography.state.pose); world.reveal(); toast('dynamic.modelLoaded'); }
  catch (error) { renderModelInfo(modelSlot.getInfo()); toastError(error); }
  finally { modelLoading = false; renderModelInfo(modelSlot.getInfo()); $('load-model').disabled = false; e.target.value = ''; }
});
$('clear-model').addEventListener('click', () => { modelSlot?.clear(); toast('dynamic.modelRemoved'); });
$('show-skeleton').addEventListener('change', e => { modelSlot?.setSkeletonVisible(e.target.checked); if (!modelSlot?.getInfo().loaded) toast('dynamic.skeletonNeedsModel'); });
$('reset-camera').addEventListener('click', () => world?.resetCamera());
$('auto-rotate').addEventListener('change', e => world?.setAutoRotate(e.target.checked));
$('particles-toggle').addEventListener('change', e => world?.setParticles(e.target.checked));
$('screenshot').addEventListener('click', () => { if (!world) return toast('dynamic.screenshotUnavailable'); try { download(world.capture(), 'moonlight-stage.png'); toast('dynamic.screenshotSaved'); } catch { toast('dynamic.screenshotFailed'); } });
if (giftConfig.model.url && modelSlot) {
  modelSlot.loadUrl(giftConfig.model.url).then(() => {
    for (const [key, bone] of Object.entries(giftConfig.model.boneMapping)) modelSlot.setMapping(key, bone);
    modelSlot.setPose(choreography.state.pose); world.reveal();
  }).catch(error => { console.warn(error); toast('dynamic.remoteModelFailed'); });
}
function refreshLanguage() {
  renderGiftCopy(); renderExperienceCopy();
  for (const { key } of specs) {
    const label = document.querySelector(`label[for="joint-${key}"]`);
    if (label) label.textContent = t(`dynamic.joint.${key}`);
  }
  renderChoreography(choreography.state);
  if (lastModelInfo) renderModelInfo(lastModelInfo);
  if (fallbackNote) fallbackNote.textContent = t('dynamic.fallbackBody');
  cinematicChapter = -1; updateCinematicPresentation(entrance.state.progress);
  showChapter = ''; presentShow();
  if (toastCopy && $('toast').classList.contains('visible')) $('toast').textContent = t(toastCopy.key, toastCopy.params);
  world?.setLanguage?.();
}
onLanguageChange(refreshLanguage);
refreshLanguage();

function tick(now) {
  if (disposed) return;
  const delta = previousTime ? Math.min((now - previousTime) / 1000, .1) : 1 / 60;
  previousTime = now; elapsed += delta;
  if (entrance.state.phase === 'running') {
    entrance.update(delta);
    updateCinematicPresentation(entrance.state.progress);
    world?.setEntranceProgress(entrance.state.progress);
    if (entrance.state.phase === 'complete') finishEntrance({ focus: true, playFireworks: true });
  }
  if (stageShow.state.active) {
    stageShow.update(delta); presentShow();
    if (stageShow.state.phase === 'complete') completeShow();
  }
  choreography.update(delta); world?.update(elapsed, delta);
  frameHandle = requestAnimationFrame(tick);
}
frameHandle = requestAnimationFrame(tick);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(frameHandle); }
  else { previousTime = 0; frameHandle = requestAnimationFrame(tick); }
});
window.addEventListener('pagehide', e => { if (e.persisted) return; disposed = true; cancelAnimationFrame(frameHandle); modelSlot?.dispose(); world?.dispose(); });
// Read-only development inspection; no second render loop is created.
window.moonlight = { choreography, world, modelSlot, openLetter, entrance, getLanguage };
