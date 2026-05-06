'use strict';

const GATE_CONFIG = {
  chat: {
    preScan: [
      { text: 'hej.', delay: 700 },
      { text: 'znalazłeś jeden z moich obiektów.', delay: 1100 },
      { text: 'naciśnij żeby zobaczyć co jest w środku.', delay: 1300 },
    ],
    noCode: [
      { text: 'hej.', delay: 700 },
      { text: 'żeby wejść, musisz zeskanować fizyczny kod.', delay: 1000 },
    ],
    scanning: [
      { text: 'szukam kodu...', delay: 400 },
    ],
    cameraError: [
      { text: 'brak dostępu do kamery.', delay: 600 },
      { text: 'zezwól na dostęp w ustawieniach przeglądarki.', delay: 900 },
    ],
    verifying: [
      { text: 'sprawdzam...', delay: 700 },
    ],
    notFound: [
      { text: 'nie znam tego kodu.', delay: 600 },
    ],
    successFirst: [
      { text: 'aktywowano.', delay: 500 },
      { text: 'ten obiekt jest teraz twój.', delay: 900 },
      { text: 'dopóki nie zeskanujesz go z innego urządzenia.', delay: 1200 },
    ],
    successKnown: [
      { text: 'witaj z powrotem.', delay: 700 },
    ],
    transfer: [
      { text: 'ten obiekt był już aktywowany.', delay: 700 },
      { text: 'jeśli go przejmiesz, poprzedni właściciel straci dostęp.', delay: 1100 },
    ],
    transferDone: [
      { text: 'obiekt jest teraz twój.', delay: 600 },
    ],
    error: [
      { text: 'coś poszło nie tak.', delay: 500 },
      { text: 'spróbuj ponownie.', delay: 700 },
    ],
  },
  buttons: {
    activate: 'aktywuj',
    scan: 'skanuj kod',
    read: 'czytaj',
    transfer: 'przejmij',
    cancel: 'nie',
    retry: 'spróbuj ponownie',
  },
};
