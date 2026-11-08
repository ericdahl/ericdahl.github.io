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
} satisfies Record<string, StoryBeat>;

export type StoryId = keyof typeof STORIES;
