export const stages = ['backlog','ready','building','done'];
export const points = [1,2,3,5,8,13];
export function validateCard(card) {
  if (!card || typeof card.title !== 'string' || !card.title.trim() || card.title.length > 120 ||
      typeof card.detail !== 'string' || card.detail.length > 2000 ||
      !points.includes(card.points) || !stages.includes(card.stage)) throw new Error('Invalid sticky note.');
  return {title:card.title.trim(), detail:card.detail.trim(), points:card.points, stage:card.stage};
}
export function applyChange(stories, change, id) {
  if (!change || !['add','edit','move'].includes(change.type)) throw new Error('Invalid action.');
  if (change.type === 'add') {
    if (stories.length >= 250) throw new Error('Board is full.');
    return [...stories, {id, ...validateCard(change.card)}];
  }
  const index = stories.findIndex(item => item.id === change.id);
  if (index < 0) throw new Error('Sticky note not found.');
  const old = stories[index];
  const card = change.type === 'edit' ? {...old, ...validateCard(change.card)} :
    {...old, stage:change.stage};
  if (!stages.includes(card.stage)) throw new Error('Invalid stage.');
  return stories.map((item,i) => i === index ? card : item);
}
