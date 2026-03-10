<template>
  <div class="modal-overlay" @click.self="$emit('sluit')">
    <div class="modal">
      <h3>Planning delen</h3>

      <!-- Generate invite -->
      <div class="invite-section">
        <p>Maak een uitnodigingslink:</p>
        <div class="invite-row">
          <select v-model="inviteRole">
            <option value="viewer">Alleen bekijken</option>
            <option value="editor">Bewerken</option>
          </select>
          <button @click="maakLink" :disabled="creating">
            {{ creating ? '...' : 'Maak link' }}
          </button>
        </div>
        <div v-if="inviteUrl" class="invite-link">
          <input :value="inviteUrl" readonly ref="linkInput" />
          <button @click="copyLink">{{ copied ? 'Gekopieerd!' : 'Kopieer' }}</button>
        </div>
      </div>

      <!-- Current members -->
      <div class="members-section">
        <h4>Leden</h4>
        <div v-if="loading" class="members-loading">Laden...</div>
        <div v-for="m in members" :key="m.id" class="member-row">
          <span class="member-email">{{ m.email || '(onbekend)' }}</span>
          <span class="member-role" :class="m.role">{{ rolLabel(m.role) }}</span>
          <button
            v-if="m.role !== 'eigenaar'"
            class="btn-remove-member"
            @click="verwijder(m)"
            title="Verwijder lid"
          >&times;</button>
        </div>
      </div>

      <div class="modal-actions">
        <button @click="$emit('sluit')">Sluiten</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { createInvite, getMembers, removeMember } from '../stores/sync.js';

const props = defineProps({ plannerId: String });
defineEmits(['sluit']);

const inviteRole = ref('viewer');
const inviteUrl = ref('');
const creating = ref(false);
const copied = ref(false);
const linkInput = ref(null);
const members = ref([]);
const loading = ref(true);

function rolLabel(role) {
  return { eigenaar: 'Eigenaar', editor: 'Editor', viewer: 'Bekijker' }[role] || role;
}

async function loadMembers() {
  loading.value = true;
  try {
    const data = await getMembers(props.plannerId);
    members.value = data.map((m) => ({
      id: m.id,
      role: m.role,
      email: m.email || null,
      userId: m.user_id,
    }));
  } catch (e) {
    console.warn('Kon leden niet laden:', e);
  }
  loading.value = false;
}

async function maakLink() {
  creating.value = true;
  copied.value = false;
  try {
    const token = await createInvite(props.plannerId, inviteRole.value);
    inviteUrl.value = `${window.location.origin}/invite/${token}`;
  } catch (e) {
    console.error('Kon link niet maken:', e);
  }
  creating.value = false;
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(inviteUrl.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    linkInput.value?.select();
  }
}

async function verwijder(member) {
  if (!confirm(`${member.email || 'Dit lid'} verwijderen?`)) return;
  try {
    await removeMember(member.id);
    members.value = members.value.filter((m) => m.id !== member.id);
  } catch (e) {
    console.error('Kon lid niet verwijderen:', e);
  }
}

onMounted(loadMembers);
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--clr-surface);
  border-radius: var(--radius);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  padding: 1.5rem;
  width: 440px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal h3 {
  margin: 0;
  font-size: 1.1rem;
}

.invite-section p {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: var(--clr-text-muted);
}

.invite-row {
  display: flex;
  gap: 0.5rem;
}

.invite-row select,
.invite-row button {
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  background: var(--clr-surface);
  cursor: pointer;
  font-family: inherit;
}

.invite-row button {
  background: var(--clr-accent);
  color: white;
  border-color: var(--clr-accent);
  font-weight: 600;
}

.invite-link {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.invite-link input {
  flex: 1;
  font-size: 0.8rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  background: var(--clr-bg);
  font-family: monospace;
}

.invite-link button {
  font-size: 0.8rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  background: var(--clr-surface);
  cursor: pointer;
  font-weight: 600;
}

.members-section h4 {
  margin: 0;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--clr-text-muted);
}

.members-loading {
  font-size: 0.85rem;
  color: var(--clr-text-muted);
}

.member-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--clr-border);
  font-size: 0.85rem;
}

.member-email {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-role {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: var(--clr-bg);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.member-role.eigenaar { color: var(--clr-accent); }
.member-role.editor { color: var(--clr-bezig); }
.member-role.viewer { color: var(--clr-text-muted); }

.btn-remove-member {
  background: none;
  border: none;
  font-size: 1.1rem;
  color: var(--clr-text-muted);
  cursor: pointer;
  padding: 0 0.3rem;
}

.btn-remove-member:hover {
  color: #ef4444;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
}

.modal-actions button {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  background: var(--clr-surface);
  color: var(--clr-text-muted);
}
</style>
