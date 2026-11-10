export type StoryboardCutId = 'vault-duel' | 'carpool-squad' | 'color-wave';

export type StoryboardArtScene =
  | 'car-door'
  | 'mirror-smile'
  | 'jesus-call'
  | 'trunk-vault'
  | 'carpool-pickup'
  | 'grey-street'
  | 'jb-street-walk'
  | 'qr-scan-hook'
  | 'color-burst-scan'
  | 'hockey-versus'
  | 'arcade-montage'
  | 'gift-vip-pass'
  | 'mirror-callback';

export interface StoryboardShot {
  shotNumber: number;
  id: string;
  timecode: string;
  durationSec: number;
  phase: 'Act I · The Call' | 'Act II · Street Drop' | 'Act III · The Blessing';
  title: string;
  art: StoryboardArtScene;
  visualAction: string;
  cameraAngle: string;
  dialogueOrText: string;
  audioCue: string;
  arcadeTieIn?: 'call-prop' | 'qr-board' | 'arcade-lobby' | 'hockey-versus' | 'vip-pass';
}

export interface StoryboardCut {
  id: StoryboardCutId;
  badge: string;
  title: string;
  totalDurationLabel: string;
  musicStyle: string;
  logline: string;
  whyItWorks: string;
  shots: StoryboardShot[];
}

export interface ProductionPropItem {
  id: string;
  category: 'Hero Props' | 'Tech & Phones' | 'Cast & Wardrobe';
  item: string;
  detail: string;
}

const OPENING_ACT_SHOTS: StoryboardShot[] = [
  {
    shotNumber: 1,
    id: 'shot-1-car-door',
    timecode: '0:00 – 0:03',
    durationSec: 3,
    phase: 'Act I · The Call',
    title: 'Vintage Classic Entrance',
    art: 'car-door',
    visualAction:
      'Golden-hour sunlight glints across polished chrome. A hand pulls the classic metal handle of a vintage car, swings the door open, and steps onto warm retro leather seats with a crimson star keychain jingling.',
    cameraAngle:
      'Low 35mm close-up on chrome door handle → smooth push-in follow as the heavy vintage door shuts cleanly.',
    dialogueOrText: '[No dialogue — pure cinematic intrigue]',
    audioCue:
      'Warm vinyl crackle + tactile mechanical door click-thud + faint distant sleigh chime.',
  },
  {
    shotNumber: 2,
    id: 'shot-2-mirror-lock',
    timecode: '0:03 – 0:06',
    durationSec: 3,
    phase: 'Act I · The Call',
    title: 'Centre Mirror Eye-Lock & Smile',
    art: 'mirror-smile',
    visualAction:
      'Driver reaches up with two fingers and tilts the centre rear-view mirror into place. Inside the rectangular mirror glass, the driver’s eyes lock directly onto the lens with a warm, knowing smile.',
    cameraAngle:
      'Macro reflection shot framed tightly inside the centre mirror (f/1.8 shallow depth of field, warm bokeh behind).',
    dialogueOrText: '[Subtle eyebrow raise + warm confident smile into the mirror]',
    audioCue: 'Soft leather creak → warm sub-bass swell + crisp acoustic sparkle on the smile.',
  },
  {
    shotNumber: 3,
    id: 'shot-3-yes-appa',
    timecode: '0:06 – 0:11',
    durationSec: 5,
    phase: 'Act I · The Call',
    title: 'Incoming Call: JESUS — “Yes Appa!”',
    art: 'jesus-call',
    visualAction:
      'The mounted phone on the vintage dash lights up! Caller ID pulses: “JESUS”. Driver grins immediately, taps the green Answer button without hesitation, and answers with joyful familiarity.',
    cameraAngle:
      'Tight over-the-shoulder insert on glowing “JESUS” Caller ID → rack-focus back to driver’s face in the mirror.',
    dialogueOrText: 'Driver: “Yes Appa! … Say less—we’re bringing Christmas to them right now!”',
    audioCue:
      'Warm melodic chime ringtone → crisp tap SFX → music bassline teases underneath the voice.',
    arcadeTieIn: 'call-prop',
  },
];

export const STORYBOARD_CUTS: StoryboardCut[] = [
  {
    id: 'vault-duel',
    badge: 'Recommended · 45s Hero Reel',
    title: 'Cut A: “Operation Christmas Joy” (Trunk Vault → Street Versus)',
    totalDurationLabel: '45 sec · 10 Shots',
    musicStyle: 'Upbeat Christmas Funk / Hip-Hop Percussion (116 BPM) with Brass & Sleigh Hits',
    logline:
      'After answering “Yes Appa!”, the vintage car trunk pops open like a Christmas gadget vault revealing glowing QR Boards & wrapped gifts—launching a high-energy 2-phone Starlight Hockey street showdown in JB.',
    whyItWorks:
      'Instant cinematic hook in the first 6 seconds, clear visual explanation of how the QR Board + 2-Phone 4-Digit Versus works on the street, and a heartwarming emotional callback at the end.',
    shots: [
      ...OPENING_ACT_SHOTS,
      {
        shotNumber: 4,
        id: 'a-shot-4-trunk-vault',
        timecode: '0:11 – 0:15',
        durationSec: 4,
        phase: 'Act II · Street Drop',
        title: 'The Trunk Vault Pops Open',
        art: 'trunk-vault',
        visualAction:
          'Driver flips a retro toggle switch—BEAT DROPS! Cut inside the vintage trunk looking upward as the lid swings open: warm fairy lights illuminate crisp CCC JB Bilingual QR Code Boards (“SCAN & BEAT MY SCORE!”) and wrapped Christmas gifts. Four team hands reach in on beat!',
        cameraAngle:
          'Low-angle “trunk-cam” looking up at the smiling evangelism squad framed against the sky.',
        dialogueOrText: 'ON-SCREEN TEXT: “OPERATION: STREET CHRISTMAS ARCADE”',
        audioCue: 'Classic trunk latch pop → FULL FUNK DRUM & SLEIGH-BELL DROP!',
        arcadeTieIn: 'qr-board',
      },
      {
        shotNumber: 5,
        id: 'a-shot-5-jb-rollout',
        timecode: '0:15 – 0:19',
        durationSec: 4,
        phase: 'Act II · Street Drop',
        title: 'Rolling Onto JB Streets',
        art: 'jb-street-walk',
        visualAction:
          'The vintage classic car cruises past lively Johor Bahru shophouses. The squad steps onto the walkway in sync, holding up bold QR Lanyard Boards with friendly energy.',
        cameraAngle:
          'Gimbal low tracking shot from spinning classic whitewall wheel up to the QR Code Board.',
        dialogueOrText: 'Evangelist (smiling to camera): “45 seconds. Beat our score—win a Christmas gift!”',
        audioCue: 'Driving bassline + cheerful street ambience.',
        arcadeTieIn: 'qr-board',
      },
      {
        shotNumber: 6,
        id: 'a-shot-6-qr-hook',
        timecode: '0:19 – 0:24',
        durationSec: 5,
        phase: 'Act II · Street Drop',
        title: 'Bored Scroll → Instant QR Arcade!',
        art: 'qr-scan-hook',
        visualAction:
          'A young pedestrian walking past tiredly spots the “BEAT ME = FREE GIFT” QR Board, pauses with a curious grin, and scans it. Camera zooms straight into their phone as the CCC JB Bilingual Christmas Arcade opens instantly—no app download!',
        cameraAngle:
          'Medium two-shot on sidewalk → whip-zoom match-cut into crisp Apple Snow Glass Arcade Lobby.',
        dialogueOrText: 'Guest: “Wait—no app install? Let’s go!” · TEXT: “SCAN QR · PLAY INSTANTLY”',
        audioCue: 'Camera scan *BEEP-CHIME* + retro arcade power-up whoosh.',
        arcadeTieIn: 'arcade-lobby',
      },
      {
        shotNumber: 7,
        id: 'a-shot-7-hockey-duel',
        timecode: '0:24 – 0:32',
        durationSec: 8,
        phase: 'Act II · Street Drop',
        title: '2-Phone Live Starlight Hockey Duel (4-Digit Code!)',
        art: 'hockey-versus',
        visualAction:
          'Guest taps “Show 4-Digit Code” (2412); Evangelist keys 2-4-1-2 into their own phone right beside them! Overhead shot of BOTH phones side-by-side as neon pucks blast across the two screens! Friends gather around gasping as Double Puck Fever hits and the guest scores 7–5 VICTORY!',
        cameraAngle:
          'Top-down two-phone split shot + fast handheld whip-pans between flying thumbs and cheering reactions.',
        dialogueOrText:
          'TEXT: “4-DIGIT CODE · 2 PHONES · LIVE VERSUS!” · Crowd: “OOOOOH! GOAL!!”',
        audioCue: 'Puck laser *ZING* SFX + arcade crowd cheer + triumphant victory fanfare.',
        arcadeTieIn: 'hockey-versus',
      },
      {
        shotNumber: 8,
        id: 'a-shot-8-solo-montage',
        timecode: '0:32 – 0:36',
        durationSec: 4,
        phase: 'Act II · Street Drop',
        title: 'Rapid-Fire Street Joy Montage',
        art: 'arcade-montage',
        visualAction:
          'Three snappy 1.3-second cuts on the drum hits: (1) Uncle laughing while dodging in Santa Street Dash, (2) Two students slicing combos in Berry Slash, (3) Young family high-fiving over Block Stack & Candy Match.',
        cameraAngle: 'Dynamic tight reaction shots at eye level with genuine street laughter.',
        dialogueOrText: 'ON-SCREEN TEXT: “5 FESTIVE GAMES · ZERO AWKWARDNESS · PURE JOY”',
        audioCue: 'Snappy rhythmic clap-clap-clap build-up.',
        arcadeTieIn: 'arcade-lobby',
      },
      {
        shotNumber: 9,
        id: 'a-shot-9-gift-pass',
        timecode: '0:36 – 0:41',
        durationSec: 5,
        phase: 'Act III · The Blessing',
        title: 'Golden VIP Pass + Real Wrapped Gift Handoff',
        art: 'gift-vip-pass',
        visualAction:
          'Confetti bursts on the guest’s phone revealing their personalised VIP Celebration Invitation (with 1-tap Waze & Save Ticket). Right on cue, the evangelist hands them a real wrapped Christmas Blessing Gift on the street!',
        cameraAngle: 'Warm medium close-up capturing the guest’s surprised smile receiving the gift.',
        dialogueOrText:
          'Guest: “No way, this is actually so nice!” · Evangelist: “Merry Christmas! Your VIP Pass is saved—see you there!”',
        audioCue: 'Warm acoustic guitar + festive bell shimmer.',
        arcadeTieIn: 'vip-pass',
      },
      {
        shotNumber: 10,
        id: 'a-shot-10-mirror-callback',
        timecode: '0:41 – 0:45',
        durationSec: 4,
        phase: 'Act III · The Blessing',
        title: 'Full Circle: Mirror Smile & CCC JB Bilingual End Card',
        art: 'mirror-callback',
        visualAction:
          'Twinkling night lights. Back in the vintage car, driver glances up at the centre mirror—reflecting new friends waving with their Christmas gifts. Phone chimes: “APPA ❤️: Well done. Save them a seat!” Driver smiles → End Card with live QR, Date & Venue.',
        cameraAngle:
          'Exact mirror framing callback to Shot 02 → clean graphic transition to End Card.',
        dialogueOrText:
          'VO / Driver: “When Appa calls, we bring Christmas to you. Spot our QR boards in JB—or scan now to play!”',
        audioCue: 'Gentle piano resolve + warm choir swell.',
        arcadeTieIn: 'call-prop',
      },
    ],
  },
  {
    id: 'carpool-squad',
    badge: 'Idea Option B · 50s Buddy-Comedy',
    title: 'Cut B: “One Classic Car, Whole Evangelism Squad”',
    totalDurationLabel: '50 sec · 9 Shots',
    musicStyle: 'Feel-Good Motown Christmas Soul ("Jingle Bell Rock" Vintage Remix)',
    logline:
      'Right after “Yes Appa!”, the vintage car pulls up curb-by-curb in fast comedy cuts as teammates hop in carrying oversized QR Boards and stacks of Christmas gifts before taking over the street.',
    whyItWorks:
      'Showcases your church team’s fun personality and camaraderie—great if 4–5 team members want funny cameo entrances in the classic car!',
    shots: [
      ...OPENING_ACT_SHOTS,
      {
        shotNumber: 4,
        id: 'b-shot-4-curb-pickup',
        timecode: '0:11 – 0:18',
        durationSec: 7,
        phase: 'Act II · Street Drop',
        title: 'Rapid Curbside Squad Pickups!',
        art: 'carpool-pickup',
        visualAction:
          'Quick Wes-Anderson-style whip-pans! Curb #1: Teammate #1 slides into the passenger seat holding two crisp QR Code Boards like superhero shields. Curb #2: Teammates #2 & #3 squeeze into the backseat behind a comical tower of wrapped Christmas gifts!',
        cameraAngle: 'Locked side-profile window shot + funny interior wide-angle lens.',
        dialogueOrText: 'Teammate peeking over gifts: “Did Appa call?!” · Driver: “Buckle up!”',
        audioCue: 'Playful tire chirp + upbeat Motown horn riff!',
        arcadeTieIn: 'qr-board',
      },
      {
        shotNumber: 5,
        id: 'b-shot-5-street-stepout',
        timecode: '0:18 – 0:23',
        durationSec: 5,
        phase: 'Act II · Street Drop',
        title: 'Slow-Mo Squad Step-Out in JB',
        art: 'jb-street-walk',
        visualAction:
          'All four vintage car doors open in unison on the street! Team steps out smiling, flipping their QR Lanyard Boards forward toward camera.',
        cameraAngle: 'Low wide hero shot across the vintage hood.',
        dialogueOrText: 'TEXT: “CCC JB BILINGUAL · STREET ARCADE SQUAD”',
        audioCue: 'Big tambourine + bass groove.',
        arcadeTieIn: 'qr-board',
      },
      {
        shotNumber: 6,
        id: 'b-shot-6-qr-scan',
        timecode: '0:23 – 0:29',
        durationSec: 6,
        phase: 'Act II · Street Drop',
        title: 'Passersby Scan & Jump In',
        art: 'qr-scan-hook',
        visualAction:
          'Shoppers & students scan the team’s QR Boards—camera pushes into the glowing Christmas Arcade game shelf loading right in their browser.',
        cameraAngle: 'Over-the-shoulder phone scan → screen fill.',
        dialogueOrText: 'Evangelist: “Pick a game—or duel me live!”',
        audioCue: 'Arcade coin chime!',
        arcadeTieIn: 'arcade-lobby',
      },
      {
        shotNumber: 7,
        id: 'b-shot-7-hockey-duel',
        timecode: '0:29 – 0:38',
        durationSec: 9,
        phase: 'Act II · Street Drop',
        title: '4-Digit Code Live Hockey Battle!',
        art: 'hockey-versus',
        visualAction:
          'Guest generates 4-digit code; teammate joins on 2nd phone. Hilarious friendly trash-talk and big cheers when the guest scores the winning goal!',
        cameraAngle: 'Overhead two-phone action + two-shot reaction.',
        dialogueOrText: 'Evangelist (laughing): “Okay okay, rematch at church on Christmas!”',
        audioCue: 'Goal horn + laughter!',
        arcadeTieIn: 'hockey-versus',
      },
      {
        shotNumber: 8,
        id: 'b-shot-8-gift-pass',
        timecode: '0:38 – 0:44',
        durationSec: 6,
        phase: 'Act III · The Blessing',
        title: 'Gift Box + Digital VIP Invitation',
        art: 'gift-vip-pass',
        visualAction:
          'Teammates hand out wrapped gifts from the classic car trunk while guests save their golden VIP Celebration Pass & Waze link.',
        cameraAngle: 'Warm sunlit candid portraits.',
        dialogueOrText: 'TEXT: “WIN A GIFT · SAVE YOUR VIP INVITE”',
        audioCue: 'Warm chorus lift.',
        arcadeTieIn: 'vip-pass',
      },
      {
        shotNumber: 9,
        id: 'b-shot-9-ending',
        timecode: '0:44 – 0:50',
        durationSec: 6,
        phase: 'Act III · The Blessing',
        title: 'Mirror Salute & Christmas Invite Card',
        art: 'mirror-callback',
        visualAction:
          'Full squad waves from the vintage car; driver taps the centre mirror with a grateful smile: “Mission accomplished, Appa.” End card with QR & service details.',
        cameraAngle: 'Centre mirror close-up → End Card.',
        dialogueOrText: 'TEXT: “SEE US ON THE STREETS? SCAN & PLAY!”',
        audioCue: 'Final sleigh bell hit.',
        arcadeTieIn: 'call-prop',
      },
    ],
  },
  {
    id: 'color-wave',
    badge: 'Idea Option C · 35s Fast TikTok/IG Hook',
    title: 'Cut C: “From Grey Scroll to Christmas Gold”',
    totalDurationLabel: '35 sec · 8 Shots',
    musicStyle: 'Lo-Fi Chill Intro → Explosive Future-Pop Christmas Drop (124 BPM)',
    logline:
      'Contrasts a black-and-white “busy tired city” with the vibrant crimson-and-gold vintage car—every QR scan literally splashes full Christmas color onto the street!',
    whyItWorks:
      'Super visual, minimal spoken dialogue needed (works great across English, Mandarin & Tamil audiences on Reels/TikTok even with sound muted!).',
    shots: [
      ...OPENING_ACT_SHOTS,
      {
        shotNumber: 4,
        id: 'c-shot-4-grey-city',
        timecode: '0:11 – 0:15',
        durationSec: 4,
        phase: 'Act II · Street Drop',
        title: 'Grey Street → Vintage Car Rolls In With Color!',
        art: 'grey-street',
        visualAction:
          'Cut to a desaturated, grey-toned walkway where people walk heads-down. Suddenly the vintage car rolls into frame in FULL saturated crimson & gold, trailing warm light!',
        cameraAngle: 'Wide static street frame broken by the colorful classic car.',
        dialogueOrText: 'TEXT: “TIRED OF THE SAME OLD SCROLL?”',
        audioCue: 'Muted city hum → rising synth riser!',
      },
      {
        shotNumber: 5,
        id: 'c-shot-5-color-scan',
        timecode: '0:15 – 0:20',
        durationSec: 5,
        phase: 'Act II · Street Drop',
        title: 'One QR Scan Bursts the Frame Into Color!',
        art: 'color-burst-scan',
        visualAction:
          'Evangelist holds out the glowing QR Code Board. The instant a passerby scans it, a circular wave of full vibrant color & snow-glass UI ripples across the entire street!',
        cameraAngle: 'Whip-zoom through QR code into vibrant phone screen.',
        dialogueOrText: 'TEXT: “SCAN THE BOARD · UNLOCK CHRISTMAS JOY”',
        audioCue: 'Crystal *CHIME* + BASS DROP!',
        arcadeTieIn: 'qr-board',
      },
      {
        shotNumber: 6,
        id: 'c-shot-6-hockey-duel',
        timecode: '0:20 – 0:27',
        durationSec: 7,
        phase: 'Act II · Street Drop',
        title: '2-Phone 4-Digit Starlight Hockey + Solo Games',
        art: 'hockey-versus',
        visualAction:
          'Fast split-screen of 4-digit Starlight Hockey 2-phone duel alongside Santa Dash & Berry Slash—strangers instantly laughing like old friends.',
        cameraAngle: 'Split-screen vertical Reel layout (top: faces, bottom: phones).',
        dialogueOrText: 'TEXT: “CHALLENGE OUR TEAM · 45s LIVE VERSUS”',
        audioCue: 'Energetic synth lead + arcade combo SFX.',
        arcadeTieIn: 'hockey-versus',
      },
      {
        shotNumber: 7,
        id: 'c-shot-7-gift-pass',
        timecode: '0:27 – 0:31',
        durationSec: 4,
        phase: 'Act III · The Blessing',
        title: 'Claim Your Gift & Golden VIP Ticket',
        art: 'gift-vip-pass',
        visualAction:
          'Wrapped Christmas gift lands in the guest’s hands while their phone displays the Golden VIP Celebration Pass & countdown.',
        cameraAngle: 'Close-up handoff → smiling eye contact.',
        dialogueOrText: 'TEXT: “FREE GIFT + VIP CHRISTMAS INVITE”',
        audioCue: 'Celebration chime!',
        arcadeTieIn: 'vip-pass',
      },
      {
        shotNumber: 8,
        id: 'c-shot-8-mirror-end',
        timecode: '0:31 – 0:35',
        durationSec: 4,
        phase: 'Act III · The Blessing',
        title: 'Mirror Wink & Scan-Now CTA',
        art: 'mirror-callback',
        visualAction:
          'Driver looks in the vintage centre mirror one last time with a joyful nod: “See you Christmas, Appa.” Full-screen QR & CCC JB Bilingual Celebration invite.',
        cameraAngle: 'Mirror tight shot → End Card.',
        dialogueOrText: 'TEXT: “CCC JB BILINGUAL · PLAY NOW OR FIND US IN JB!”',
        audioCue: 'Warm acoustic outro chord.',
        arcadeTieIn: 'call-prop',
      },
    ],
  },
];

export const PRODUCTION_PROPS_CHECKLIST: ProductionPropItem[] = [
  {
    id: 'prop-vintage-car',
    category: 'Hero Props',
    item: 'Vintage Classic Car (clean chrome handle & centre mirror)',
    detail:
      'Wipe the centre rear-view mirror spotless so Shot 02 & Shot 10 capture crisp eye reflections without glare.',
  },
  {
    id: 'prop-qr-boards',
    category: 'Hero Props',
    item: '2–4 Printed A4 / Lanyard QR Code Boards',
    detail:
      'Generate & print directly from /team → QR Board Maker (e.g. “Beat Andrew!”) mounted on foamcore so it reads crisply on camera.',
  },
  {
    id: 'prop-gifts',
    category: 'Hero Props',
    item: '6–10 Wrapped Christmas Blessing Gifts (Crimson & Gold)',
    detail:
      'Used inside the classic car trunk (Shot 04) and handed to street guests on camera (Shot 09).',
  },
  {
    id: 'prop-call-phone',
    category: 'Tech & Phones',
    item: 'Dashboard Phone + Mount Running Built-In “JESUS Calling” Prop',
    detail:
      'Tap “Launch JESUS Call Prop” at the top of /storyboard, set brightness to 80%, and mount near the centre console for Shot 03.',
  },
  {
    id: 'prop-versus-phones',
    category: 'Tech & Phones',
    item: '2 Charged Phones Open to Starlight Air Hockey (/)',
    detail:
      'Turn screen brightness up and disable auto-lock so Shot 07’s 4-digit code (Show Code → Enter Code) films in one smooth take.',
  },
  {
    id: 'prop-wardrobe',
    category: 'Cast & Wardrobe',
    item: 'Smart-Casual Festive Palette (Cream, Crimson, Pine Green, Denim)',
    detail:
      'Avoid tiny stripes (moiré on camera); warm festive colors pop against the vintage car interior and JB evening streets.',
  },
];
