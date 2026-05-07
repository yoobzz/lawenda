var GATE_CONFIG = {
  intro: 'hej.',
  activateLabel: 'czytaj',
  welcomeFirst: [
    { text: 'znajdka otwarta.', delay: 700 },
    { text: 'to pierwsze wejście z tego urządzenia.', delay: 900 },
  ],
  welcomeReturning: [
    { text: 'witaj z powrotem.', delay: 700 },
    { text: 'ta znajdka już cię pamięta.', delay: 900 },
  ],
  transferConfirm: 'przejmij',
  welcomeTransferred: [
    { text: 'gotowe.', delay: 700 },
    { text: 'znajdka jest teraz przypisana tutaj.', delay: 900 },
  ],
  noCodeIntro: [
    { text: 'to nie błąd.', delay: 700 },
    { text: 'trafiłeś do lawendy.', delay: 900 },
    { text: 'żeby wejść do wierszy, potrzebujesz znajdki.', delay: 1000 },
    { text: 'znajdka to fizyczny przedmiot z kodem qr.', delay: 1100 },
    { text: 'znajdki są poukrywane w warszawie.', delay: 1100 },
  ],
  noCodeManualInputLabel: 'mam znajdkę, wpiszę kod',
  noCodeReturnLabel: '← wracam',
  withCodeConfirm: [
    { text: 'teraz pokaż znajdkę kamerze.', delay: 800 },
  ],
  withCodeActivateLabel: 'pokaż kamerze',
  scanStatuses: {
    searching: 'szukam znajdki',
    detected: 'widzę kod',
    opening: 'otwieram',
  },
  manualInputPrompt: 'wpisz 4-znakowy kod ze znajdki',
  manualInputErrorInvalid: 'taki kod nie istnieje',
  cameraUnavailable: 'kamera niedostępna. wpisz kod ręcznie',
  noAccess: [
    { text: 'tu czegoś brakuje.', delay: 700 },
    { text: 'nie mogę otworzyć wejścia w tym trybie.', delay: 900 },
    { text: 'wejdź ponownie przez znajdkę albo wpisz kod ręcznie.', delay: 1000 },
  ],
  transferFlow: [
    { text: 'ta znajdka była już aktywowana na innym urządzeniu.', delay: 800 },
    { text: 'jeśli przejmiesz, tamten dostęp zgaśnie.', delay: 1000 },
  ],
  notFound: [
    { text: 'taki kod nie istnieje.', delay: 650 },
  ],
  error: [
    { text: 'coś poszło nie tak.', delay: 550 },
    { text: 'spróbuj ponownie.', delay: 800 },
  ],
  buttons: {
    read: 'czytaj',
    transfer: 'przejmij',
    cancel: 'nie teraz',
    retry: 'spróbuj ponownie',
    manualSubmit: 'otwórz',
  },
};
