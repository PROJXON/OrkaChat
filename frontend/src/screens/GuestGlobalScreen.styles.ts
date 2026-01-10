import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#0b0b0f',
  },
  headerRow: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    zIndex: 10,
    elevation: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e3e3e3',
    backgroundColor: '#fafafa',
  },
  headerRowDark: {
    backgroundColor: '#1c1c22',
    borderBottomColor: '#2a2a33',
  },
  headerRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  contentColumn: { width: '100%', maxWidth: 1040, alignSelf: 'center' },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
  },
  headerTitleDark: {
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e3e3e3',
  },
  themeToggleDark: {
    backgroundColor: '#14141a',
    borderColor: '#2a2a33',
  },
  // Web-only: avoid browser default teal/blue accent that can bleed into the native Switch implementation.
  webToggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 999,
    padding: 2,
    backgroundColor: '#d1d1d6',
    justifyContent: 'center',
  },
  webToggleTrackOn: {
    // Match mobile: keep the track light; the "on" state is indicated by thumb position.
    backgroundColor: '#d1d1d6',
  },
  webToggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    transform: [{ translateX: 0 }],
  },
  webToggleThumbOn: {
    backgroundColor: '#2a2a33',
    transform: [{ translateX: 18 }],
  },
  menuIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f2f2f7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3e3e3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconBtnDark: {
    backgroundColor: '#2a2a33',
    borderColor: '#2a2a33',
    borderWidth: 0,
  },
  errorText: {
    paddingHorizontal: 12,
    paddingBottom: 6,
    color: '#b00020',
    fontSize: 12,
  },
  errorTextDark: {
    color: '#ff6b6b',
  },
  loadingWrap: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 6,
    // Inverted list: include symmetric padding so the newest message doesn't hug the bottom bar.
    paddingTop: 12,
    paddingBottom: 12,
  },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e3e3e3',
    backgroundColor: '#f2f2f7',
  },
  bottomBarInner: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  bottomBarDark: {
    backgroundColor: '#1c1c22',
    borderTopColor: '#2a2a33',
  },
  bottomBarCta: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBarCtaDark: {
    backgroundColor: '#2a2a33',
  },
  bottomBarCtaText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  bottomBarCtaTextDark: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '92%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalCardDark: {
    backgroundColor: '#14141a',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginBottom: 10,
  },
  modalTitleDark: { color: '#fff' },
  modalScroll: { maxHeight: 420 },
  modalRowText: { color: '#222', lineHeight: 20, marginBottom: 8 },
  modalRowTextDark: { color: '#d7d7e0' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 8 },
  modalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f2f2f7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3e3e3',
  },
  modalBtnDark: {
    backgroundColor: '#1c1c22',
    borderColor: '#2a2a33',
  },
  modalBtnText: { color: '#111', fontWeight: '800' },
  modalBtnTextDark: { color: '#fff' },
});

export const guestReactionInfoModalStyles = {
  // Map the shared modal component's style keys to GuestGlobalScreen styles.
  modalOverlay: styles.modalOverlay,
  summaryModal: styles.modalCard,
  summaryModalDark: styles.modalCardDark,
  summaryTitle: styles.modalTitle,
  summaryTitleDark: styles.modalTitleDark,
  summaryScroll: styles.modalScroll,
  summaryText: styles.modalRowText,
  summaryTextDark: styles.modalRowTextDark,
  summaryButtons: styles.modalButtons,
  toolBtn: styles.modalBtn,
  toolBtnDark: styles.modalBtnDark,
  toolBtnText: styles.modalBtnText,
  toolBtnTextDark: styles.modalBtnTextDark,
  reactionInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reactionInfoRemoveHint: { opacity: 0.7, fontSize: 12 },
};
