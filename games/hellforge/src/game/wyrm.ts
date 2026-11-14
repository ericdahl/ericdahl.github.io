/**
 * Tyriach, the Brass Wyrm: an optional encounter in a cave high above Gloomwood, well above that area's level.
 * He is asleep on a hoard and would rather talk than fight. A hero can run an errand for him, challenge him,
 * or rob him while he sleeps. He does not die: beaten, he yields and pays from the hoard. Each difficulty has its own.
 */
export const WYRM_AREA = 'wyrm_roost';
export const WYRM_FROM = 'gloomwood';
export const WYRM_NAME = 'Tyriach, the Brass Wyrm';
/** Where the errand's letter goes: the captain in this town. */
export const ERRAND_TOWN = 'tel_maresh';

/** How he is, right now. Kept on the monster; the lasting parts are in the hero's quest log. */
export type WyrmState = 'asleep' | 'awake' | 'fight' | 'yielded';

/** Life left (0..1) at which he calls a fight off. Robbed, he is harder to satisfy. */
export const YIELD_AT = 0.25;
export const YIELD_ANGRY = 0.1;

export type WyrmTalk =
  /** First meeting, or any time nothing is owed either way. */
  | 'greet'
  /** The errand is taken and not yet done. */
  | 'errand_out'
  /** The letter is delivered: he pays. */
  | 'errand_pay'
  /** He has yielded a fair fight: he pays. */
  | 'fight_pay'
  /** Everything he had for this hero on this difficulty has been had. */
  | 'done'
  /** He yielded after being robbed. He pays nothing more. */
  | 'robbed';

export const WYRM_LINES: Record<WyrmTalk, string[]> = {
  greet: [
    'One great eye opens. It is the size of a shield, and it is not impressed. Then the dragon is simply not there, and a tall man in red and gold is standing on the coins instead, brushing ash from his sleeve.',
    '"A visitor. How tiresome. I have slept through two empires and I was hoping to sleep through whatever this is. You smell of ash. Everything smells of ash lately. It is getting on my gold."',
    '"Well? You have climbed all this way. You want something, or you want to fight me, or you are lost. Be quick. Brevity is a courtesy the short-lived can actually afford."',
  ],
  errand_out: [
    '"You are still here. The letter is not. I can only assume it is in your pack and not in Tel Maresh, where I distinctly said."',
    '"The captain of the sellswords. Put it in their hand. I would go myself, but then people scream, and it takes all afternoon."',
  ],
  errand_pay: [
    '"Delivered? And unopened? Remarkable. I have known archmages who could not manage both."',
    '"A dragon pays his debts. Choose one thing from the pile. One. I will know."',
  ],
  fight_pay: [
    '"Enough. ENOUGH. I yield, in the sense that I am bored and you are evidently not going to stop."',
    '"That was almost invigorating. I have not been properly singed in four hundred years. Take one thing from the hoard, with my compliments, and tell no one how long that took."',
  ],
  done: [
    '"You again. We have concluded our business, you and I. I am going back to sleep."',
    '"Come back when the world has grown harder, if it does. It usually does."',
  ],
  robbed: [
    '"Thief. You have had your prize already, out of my own hoard, while I slept. You will get nothing more from me but the door."',
  ],
};

/** What the well-dressed stranger in the towns has to say, by how much the hero knows. */
export type StrangerTalk = 'unmet' | 'met' | 'errand' | 'paid';
export const STRANGER_NAME = 'A Well-Dressed Stranger';
export const STRANGER_LINES: Record<StrangerTalk, string[]> = {
  unmet: [
    'A tall man in red and gold, far too clean for this place, is studying the camp as if deciding whether to buy it.',
    '"Hm? No, I am not selling anything. I am merely looking in. One likes to know what the neighbours are doing, and yours have been burning things."',
    '"You have the look of someone who climbs. There is a ridge above Gloomwood with a fine view and a cave nobody goes into. I should not go into it either, if I were you. I would be very annoyed."',
  ],
  met: [
    'He does not turn round. "Yes, yes. It is me. In a manner of speaking. I am not, strictly, here. I am asleep on a great deal of gold and this is a sort of afterthought."',
    '"Do stop staring. The shape is a courtesy. People will not sell wine to the other one."',
  ],
  errand: [
    '"Do not look at me. Do not wave. The captain. Over there. The letter goes in the captain\'s hand, not mine. I am here to see that it does, and I was never here at all."',
  ],
  paid: [
    '"Ah. The courier. Or the duellist. Whichever you prefer to be remembered as." He inclines his head a very small distance, which you suspect is a great honour.',
    '"We are square, you and I. That is rarer than gold. Go on. The world is not going to rescue itself, and I am certainly not going to do it."',
  ],
};

export const WYRM_OFFERS: { errand: string; challenge: string; leave: string } = {
  errand: '"There is a letter. It must reach the captain of the sellswords in Tel Maresh, in the south. I cannot be seen to send it. Carry it, and I will pay you from the hoard."',
  challenge: '"You wish to fight me. Me. Very well. I shall try to stay awake for it."',
  leave: '"Then go. Quietly. Do not touch anything."',
};
