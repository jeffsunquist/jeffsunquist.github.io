// Original chibi pixel-art characters for Basado Bowl.
//
// These are hand-built SVG pixel sprites (a 40x48 grid), not official artwork.
// The three teams are Blue, Red, and Yellow.

const OUT = '#1b1b3a';
const SKIN = '#ffd9c0';
const SKIN2 = '#eeb198';
const WHITE = '#fffdf4';
const EYE = '#1b1b3a';
const CHEEK = '#ff9eb5';

function wrap(parts) {
  return `<svg class="pixel-char" viewBox="0 0 40 48" shape-rendering="crispEdges" aria-hidden="true">${parts}</svg>`;
}

function baseBody({ outfit, skirt, shoe, collar = WHITE, accent, tie }) {
  return `
    <!-- legs -->
    <rect x="13" y="34" width="6" height="10" fill="${OUT}"/>
    <rect x="21" y="34" width="6" height="10" fill="${OUT}"/>
    <rect x="14" y="35" width="4" height="8" fill="${SKIN2}"/>
    <rect x="22" y="35" width="4" height="8" fill="${SKIN2}"/>
    <rect x="11" y="42" width="9" height="4" fill="${OUT}"/>
    <rect x="20" y="42" width="9" height="4" fill="${OUT}"/>
    <rect x="12" y="42" width="7" height="3" fill="${shoe}"/>
    <rect x="21" y="42" width="7" height="3" fill="${shoe}"/>

    <!-- neck -->
    <rect x="17" y="19" width="6" height="5" fill="${OUT}"/>
    <rect x="18" y="19" width="4" height="4" fill="${SKIN}"/>

    <!-- torso -->
    <rect x="10" y="22" width="20" height="13" fill="${OUT}"/>
    <rect x="11" y="23" width="18" height="11" fill="${outfit}"/>
    <rect x="16" y="23" width="8" height="3" fill="${collar}"/>
    ${tie ? `<rect x="19" y="25" width="2" height="5" fill="${tie}"/>` : ''}
    <rect x="11" y="30" width="18" height="2" fill="${accent}"/>

    <!-- skirt -->
    <rect x="8" y="32" width="24" height="6" fill="${OUT}"/>
    <rect x="9" y="32" width="22" height="4" fill="${skirt}"/>
    <rect x="9" y="35" width="22" height="1" fill="${accent}"/>

    <!-- left arm down -->
    <rect x="6" y="23" width="5" height="12" fill="${OUT}"/>
    <rect x="7" y="24" width="3" height="10" fill="${SKIN2}"/>
    <rect x="7" y="23" width="3" height="4" fill="${outfit}"/>
    <rect x="6" y="33" width="4" height="3" fill="${SKIN}"/>


    <!-- head -->
    <rect x="10" y="7" width="20" height="16" fill="${OUT}"/>
    <rect x="11" y="8" width="18" height="14" fill="${SKIN}"/>
    <rect x="11" y="20" width="18" height="2" fill="${SKIN2}"/>

    <!-- face -->
    <rect x="15" y="13" width="3" height="3" fill="${EYE}"/>
    <rect x="23" y="13" width="3" height="3" fill="${EYE}"/>
    <rect x="16" y="13" width="1" height="1" fill="${WHITE}"/>
    <rect x="24" y="13" width="1" height="1" fill="${WHITE}"/>
    <rect x="14" y="17" width="2" height="1" fill="${CHEEK}"/>
    <rect x="25" y="17" width="2" height="1" fill="${CHEEK}"/>
    <rect x="19" y="18" width="3" height="1" fill="${OUT}"/>
  `;
}

function openArm(outfit) {
  return `
    <!-- straight casting arm extending right, palm up -->
    <rect x="28" y="23" width="11" height="5" fill="${OUT}"/>
    <rect x="29" y="24" width="3" height="3" fill="${outfit}"/>
    <rect x="32" y="24" width="5" height="3" fill="${SKIN2}"/>
    <rect x="37" y="23" width="3" height="5" fill="${OUT}"/>
    <rect x="37" y="24" width="3" height="2" fill="${SKIN}"/>
    <rect x="36" y="22" width="2" height="2" fill="${OUT}"/>
    <rect x="36" y="22" width="1" height="1" fill="${SKIN}"/>
    <rect x="39" y="24" width="1" height="1" fill="${SKIN2}"/>
  `;
}

function blueSprite() {
  return wrap(`
    <!-- twin-tails behind the body -->
    <rect x="4" y="7" width="6" height="14" fill="${OUT}"/>
    <rect x="3" y="17" width="7" height="11" fill="${OUT}"/>
    <rect x="5" y="27" width="5" height="7" fill="${OUT}"/>
    <rect x="30" y="7" width="6" height="14" fill="${OUT}"/>
    <rect x="30" y="17" width="7" height="11" fill="${OUT}"/>
    <rect x="30" y="27" width="5" height="7" fill="${OUT}"/>
    <rect x="5" y="8" width="4" height="13" fill="#39c5bb"/>
    <rect x="4" y="18" width="5" height="9" fill="#39c5bb"/>
    <rect x="6" y="27" width="3" height="6" fill="#2a9d94"/>
    <rect x="31" y="8" width="4" height="13" fill="#39c5bb"/>
    <rect x="31" y="18" width="5" height="9" fill="#39c5bb"/>
    <rect x="31" y="27" width="3" height="6" fill="#2a9d94"/>
    <rect x="6" y="19" width="2" height="5" fill="#2a9d94"/>
    <rect x="32" y="19" width="2" height="5" fill="#2a9d94"/>

    ${baseBody({
      outfit: '#2c2c3c',
      skirt: '#2c2c3c',
      shoe: '#1e5f7a',
      collar: WHITE,
      accent: '#39c5bb',
      tie: '#1e6bff',
    })}

    <!-- hair cap and bangs -->
    <rect x="9" y="3" width="22" height="9" fill="${OUT}"/>
    <rect x="10" y="4" width="20" height="7" fill="#39c5bb"/>
    <rect x="10" y="8" width="5" height="6" fill="#39c5bb"/>
    <rect x="25" y="8" width="5" height="6" fill="#39c5bb"/>
    <rect x="15" y="4" width="3" height="7" fill="#2a9d94"/>
    <rect x="22" y="4" width="3" height="7" fill="#2a9d94"/>
    <rect x="10" y="9" width="4" height="2" fill="#2a9d94"/>
    <rect x="26" y="9" width="4" height="2" fill="#2a9d94"/>

    <!-- headset accent -->
    <rect x="9" y="10" width="2" height="4" fill="#ff3b5c"/>
    <rect x="29" y="10" width="2" height="4" fill="#ff3b5c"/>

    ${openArm('#2c2c3c')}
  `);
}

function redSprite() {
  return wrap(`
    <!-- drill twin-tails behind the body -->
    <rect x="3" y="7" width="7" height="7" fill="${OUT}"/>
    <rect x="2" y="13" width="7" height="7" fill="${OUT}"/>
    <rect x="4" y="19" width="6" height="6" fill="${OUT}"/>
    <rect x="30" y="7" width="7" height="7" fill="${OUT}"/>
    <rect x="31" y="13" width="7" height="7" fill="${OUT}"/>
    <rect x="30" y="19" width="6" height="6" fill="${OUT}"/>
    <rect x="4" y="8" width="5" height="5" fill="#e23b4e"/>
    <rect x="3" y="14" width="5" height="5" fill="#e23b4e"/>
    <rect x="5" y="19" width="4" height="5" fill="#b02a3b"/>
    <rect x="31" y="8" width="5" height="5" fill="#e23b4e"/>
    <rect x="31" y="14" width="5" height="5" fill="#e23b4e"/>
    <rect x="31" y="19" width="4" height="5" fill="#b02a3b"/>
    <rect x="5" y="9" width="2" height="2" fill="#ff8a9a"/>
    <rect x="32" y="9" width="2" height="2" fill="#ff8a9a"/>

    ${baseBody({
      outfit: '#e23b4e',
      skirt: '#2b2b3a',
      shoe: '#2b2b3a',
      collar: WHITE,
      accent: '#ffd23f',
      tie: '#b02a3b',
    })}

    <!-- hair cap and bangs -->
    <rect x="9" y="3" width="22" height="9" fill="${OUT}"/>
    <rect x="10" y="4" width="20" height="7" fill="#e23b4e"/>
    <rect x="10" y="8" width="5" height="6" fill="#e23b4e"/>
    <rect x="25" y="8" width="5" height="6" fill="#e23b4e"/>
    <rect x="14" y="4" width="3" height="7" fill="#b02a3b"/>
    <rect x="23" y="4" width="3" height="7" fill="#b02a3b"/>
    <rect x="10" y="9" width="4" height="2" fill="#b02a3b"/>
    <rect x="26" y="9" width="4" height="2" fill="#b02a3b"/>

    <!-- hair clip -->
    <rect x="24" y="6" width="4" height="2" fill="#ffd23f"/>
    <rect x="25" y="5" width="2" height="4" fill="#ffd23f"/>

    ${openArm('#e23b4e')}
  `);
}

function yellowSprite() {
  return wrap(`
    ${baseBody({
      outfit: '#2b3a6b',
      skirt: '#2b3a6b',
      shoe: '#1b1b3a',
      collar: WHITE,
      accent: '#ffd23f',
      tie: '#ffd23f',
    })}

    <!-- phone in the lowered hand -->
    <rect x="4" y="31" width="5" height="8" fill="${OUT}"/>
    <rect x="5" y="32" width="3" height="6" fill="#e2e8f0"/>
    <rect x="5" y="32" width="3" height="3" fill="#41e0ff"/>

    <!-- bob hair -->
    <rect x="9" y="3" width="22" height="9" fill="${OUT}"/>
    <rect x="10" y="4" width="20" height="7" fill="#ffd447"/>
    <rect x="9" y="8" width="4" height="9" fill="#ffd447"/>
    <rect x="27" y="8" width="4" height="9" fill="#ffd447"/>
    <rect x="14" y="4" width="3" height="7" fill="#e0b52e"/>
    <rect x="23" y="4" width="3" height="7" fill="#e0b52e"/>
    <rect x="10" y="9" width="4" height="2" fill="#e0b52e"/>
    <rect x="26" y="9" width="4" height="2" fill="#e0b52e"/>

    <!-- side ponytail on the viewer's right -->
    <rect x="27" y="6" width="4" height="5" fill="${OUT}"/>
    <rect x="30" y="8" width="5" height="5" fill="${OUT}"/>
    <rect x="32" y="12" width="4" height="8" fill="${OUT}"/>
    <rect x="33" y="19" width="3" height="4" fill="${OUT}"/>
    <rect x="28" y="7" width="3" height="3" fill="#ff9f1c"/>
    <rect x="30" y="9" width="4" height="3" fill="#ffd447"/>
    <rect x="32" y="12" width="3" height="6" fill="#ffd447"/>
    <rect x="33" y="18" width="2" height="3" fill="#e0b52e"/>
    <rect x="33" y="12" width="1" height="5" fill="#e0b52e"/>

    <!-- yellow ribbon -->
    <rect x="16" y="1" width="9" height="4" fill="${OUT}"/>
    <rect x="17" y="2" width="7" height="2" fill="#ffd23f"/>
    <rect x="19" y="0" width="4" height="3" fill="#ffd23f"/>
    <rect x="20" y="3" width="2" height="2" fill="#ff9f1c"/>

    <!-- collar bow -->
    <rect x="18" y="24" width="5" height="3" fill="${OUT}"/>
    <rect x="19" y="24" width="3" height="2" fill="#ffd23f"/>

    ${openArm('#2b3a6b')}
  `);
}

export const CHARACTERS = {
  blue: {
    id: 'blue',
    name: 'Blue',
    fullName: 'Blue',
    hair: '#39c5bb',
    accent: '#39c5bb',
    sprite: blueSprite(),
  },
  red: {
    id: 'red',
    name: 'Red',
    fullName: 'Red',
    hair: '#e23b4e',
    accent: '#e23b4e',
    sprite: redSprite(),
  },
  yellow: {
    id: 'yellow',
    name: 'Yellow',
    fullName: 'Yellow',
    hair: '#ffd447',
    accent: '#ffd23f',
    sprite: yellowSprite(),
  },
};

export function characterSVG(id) {
  return (CHARACTERS[id] || CHARACTERS.blue).sprite;
}
