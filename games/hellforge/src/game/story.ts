/** Full-screen story beats. Each plays once per difficulty. */
export interface StoryBeat {
  title: string;
  lines: string[];
}

export const STORIES = {
  forge_end: {
    title: 'The Hellforge Grows Cold',
    lines: [
      'Vhorza, Mother of Cinders, sinks to her knees. Her last breath leaves the forge not as smoke but as wind, and the wind goes south.',
      'For a moment you could swear she looked relieved.',
      'Return to Old Corvin. He will want to hear this.',
    ],
  },
  arrive: {
    title: 'Tel Maresh',
    lines: [
      'The caravan leaves you where the road gives up. South of here there is no sand, only glass: a black-green sea of it, horizon to horizon, still warm to the touch.',
      'The ash followed you. It drifts in over the walls and settles on the well.',
      '"You are the one who killed the Mother of Cinders," says the Archivist. "Old Corvin\'s letter said you would come. Sit. A great deal is wrong here."',
    ],
  },
  vizier: {
    title: 'Last Words of the Vizier',
    lines: [
      'The wrappings fall loose. Under them there is only dust, and a voice that should have stopped centuries ago.',
      '"Did he tell you she was a monster? She was my queen. When the Dialists pulled a dead star down from the sky, and the city burned to glass around it, Vhorza reached into the fire and took out its heart."',
      '"She carried it north as far as she could walk, and sealed it inside herself at the bottom of a forge. Every imp you ever killed was a spark she could not hold in. And you... you put out the only thing holding it."',
      '"Ask the old man why he never ages. Ask Corvane, High Dialist of Imhara, who sent you."',
    ],
  },
  corvin: {
    title: 'The Noon Vault',
    lines: [
      'He is waiting at the foot of the dead star, in the same patched robe, leaning on the same blue staff. He looks pleased to see you.',
      '"There you are. I did tell you to come south. Four hundred years I have waited for someone strong enough to kill her, and all it cost me was identifying your trinkets."',
      '"Do not look so wounded. I was honest about the important part. I told you the Hellforge would go cold. I only left out where the fire would go."',
    ],
  },
  finale: {
    title: 'The Hollow Sun Sets',
    lines: [
      'Corvane comes apart like a struck bell. Above you the dead star gutters, and for one moment the Vault is truly dark.',
      'Something small and warm settles into your hand: a single ember, the last of her. It does not burn. A woman\'s voice, very tired, very far away:',
      '"Thank you. Keep it lit."',
    ],
  },
  ember_dims: {
    title: 'The Ember Dims',
    lines: [
      'You open your hand to show the Archivist. The ember is the size of a seed now, and the colour of a coal an hour after the fire.',
      '"It is going out," Imre says. "Of course it is. It was never a flame, only the last of the thing that fed one. And listen." He holds up a letter, its edges white with frost. "From Emberwatch. Written in June. They are burning the palisade to stay alive."',
      '"She did not only hold the star in. She held the cold out. Four hundred winters, banked behind one forge. Take it home, before it has nowhere to go home to."',
    ],
  },
  north: {
    title: 'Emberwatch, Under Snow',
    lines: [
      'The caravan stops a mile short. The oxen will not go on. You walk the rest, and for a long time you do not recognise the place you are walking into.',
      'The palisade is gone, burned stake by stake. The tents are drifts with poles in them. One fire is left, in the middle of the camp, and everyone still alive is standing as close to it as they can bear.',
      '"You came back," says Wren. She is wearing Corvin\'s second-best robe over two of her own. "Good. Do you still have it? Do not show me here. The cold notices."',
    ],
  },
  frostwright: {
    title: 'What the Frostwright Made',
    lines: [
      'The ice lets go of him all at once. Under it there is a man in a smith\'s apron, old as the mine, with hands burned to the wrist.',
      '"Founder Odrun. I poured her forge. The Bellfounders cast it the way we cast everything, as a bell, mouth to the sky, so that it would ring if she ever failed. In four hundred years it never rang."',
      '"Then the fire went south, and the cold came up the shaft and took my hands and told me to make it things. I made them. I am sorry about the imps."',
      '"The bell is still there, at the Heart. It is cracked, but it will hold an ember. Set it at the lip, not the bowl. She will tell you. She always did like to tell us."',
    ],
  },
  echo: {
    title: 'The Last Phylactery',
    lines: [
      'There is a bell in the middle of the hall that nobody cast. It is the blue of his staff, and it is humming a voice you know.',
      '"You broke the jar I kept in Imhara. Did you think a man who planned for four centuries kept one jar? I left this with the founders the year I taught them to ring fire out of the earth."',
      '"I do not want the ember, child. I want what I always wanted, which is for it to go out. Then the cold has her shape and no keeper, and a keeper is a thing I know how to be."',
    ],
  },
  unlit: {
    title: 'The Unlit',
    lines: [
      'The Hellforge is a bell the size of a cathedral, mouth to the sky, and the sky comes down into it as snow. Something is kneeling in the bowl where the fire used to be.',
      'It has her horns. It has her wings, and the cracks across her chest, but nothing shows through the cracks. It is the hole a fire leaves. It turns towards the warmth in your hand the way a drowning thing turns towards air.',
      'The ember stirs against your palm. "That is not me," says the tired voice. "That is the winter, wearing what I left behind. Do not let it put me out."',
    ],
  },
  rekindle: {
    title: 'Keep It Lit',
    lines: [
      'The Unlit folds in on itself like paper in a grate, and for the space of a breath the Heart of the Hellforge is nothing but cold iron and falling snow.',
      'You set the ember at the lip of the bell, where the founder said. It sits there, small and red and unconvinced. Then the crack beside it begins to glow, and the next, and the snow stops reaching the floor.',
      'Far above you the great bell sounds once, the note it was cast to sound if she failed, and never has. Along the whole of the Ember Road, the braziers you lit lean towards it.',
      '"There," says Vhorza, from everywhere the light is. "Now it is your fire too. I held it for four hundred years. You only have to hold it until morning."',
    ],
  },
} satisfies Record<string, StoryBeat>;

export type StoryId = keyof typeof STORIES;
