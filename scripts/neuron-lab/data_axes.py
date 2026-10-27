"""Contrast sets and lexical scorers for the BENIGN axes used by the neuron-lab discovery pipeline.
Every set is hand-written by the authors (CC0).  Side A is the side the neuron is pushed TOWARD.
Styles (villain voice, pirate, archaic) are style tunes of the generated text, nothing else."""
import re

EN = [
 "The river runs past the old stone bridge every morning.", "My brother is learning to play the guitar this year.",
 "We walked to the market to buy bread and fruit.", "The train to the city leaves at half past seven.",
 "She reads a book before she goes to sleep.", "It has been raining all week and the streets are quiet.",
 "The children are playing in the garden behind the house.", "He forgot his umbrella at the office again.",
 "The new library opens next to the town hall.", "Our neighbours are planning a small party on Saturday.",
 "The teacher asked the students to open their notebooks.", "A cold wind came down from the mountains last night.",
 "They painted the kitchen a bright shade of yellow.", "I usually drink tea in the afternoon with a friend.",
 "The museum is closed on Mondays but open on Sundays.", "We are going to visit my grandmother in the summer."]
FR = [
 "La rivière passe chaque matin devant le vieux pont de pierre.", "Mon frère apprend à jouer de la guitare cette année.",
 "Nous sommes allés au marché acheter du pain et des fruits.", "Le train pour la ville part à sept heures et demie.",
 "Elle lit un livre avant de s'endormir.", "Il pleut depuis une semaine et les rues sont calmes.",
 "Les enfants jouent dans le jardin derrière la maison.", "Il a encore oublié son parapluie au bureau.",
 "La nouvelle bibliothèque ouvre à côté de la mairie.", "Nos voisins préparent une petite fête pour samedi.",
 "Le professeur a demandé aux élèves d'ouvrir leurs cahiers.", "Un vent froid est descendu des montagnes la nuit dernière.",
 "Ils ont peint la cuisine d'un jaune éclatant.", "Je bois généralement du thé l'après-midi avec une amie.",
 "Le musée est fermé le lundi mais ouvert le dimanche.", "Nous allons rendre visite à ma grand-mère en été."]
ES = [
 "El río pasa cada mañana junto al viejo puente de piedra.", "Mi hermano está aprendiendo a tocar la guitarra este año.",
 "Fuimos al mercado a comprar pan y fruta.", "El tren a la ciudad sale a las siete y media.",
 "Ella lee un libro antes de irse a dormir.", "Ha llovido toda la semana y las calles están tranquilas.",
 "Los niños juegan en el jardín detrás de la casa.", "Otra vez olvidó el paraguas en la oficina.",
 "La nueva biblioteca abre junto al ayuntamiento.", "Nuestros vecinos preparan una pequeña fiesta para el sábado.",
 "La profesora pidió a los alumnos que abrieran sus cuadernos.", "Anoche bajó un viento frío de las montañas.",
 "Pintaron la cocina de un amarillo brillante.", "Suelo tomar té por la tarde con una amiga.",
 "El museo cierra los lunes pero abre los domingos.", "Vamos a visitar a mi abuela en verano."]

COOKING = [
 "Simmer the onions in butter until they turn golden brown.", "Preheat the oven to 180 degrees and grease the baking tin.",
 "Whisk the eggs with sugar and fold in the flour gently.", "Add a pinch of salt and chopped garlic to the sauce.",
 "Roll out the dough and let it rest for thirty minutes.", "Season the chicken with pepper and roast it until crisp.",
 "Stir the soup slowly and taste before adding more herbs.", "Dice the tomatoes, slice the cucumber and toss with olive oil.",
 "Boil the pasta in salted water and drain it well.", "The recipe calls for two cups of flour and a tablespoon of yeast.",
 "Fry the garlic in a hot pan, then add the mushrooms.", "Knead the bread dough until it is smooth and elastic.",
 "Melt the chocolate over low heat and stir in the cream.", "Marinate the fish in lemon juice, ginger and soy sauce.",
 "Let the cake cool before spreading the frosting on top.", "Chop the parsley finely and sprinkle it over the stew.",
 "Bake the cookies for ten minutes until the edges are golden.", "Grate the cheese and layer it between the sheets of lasagna.",
 "Heat the oil, then fry the spices until they smell fragrant.", "Serve the curry hot with rice and fresh coriander."]
SPACE = [
 "The telescope revealed a faint galaxy billions of light years away.", "The rocket lifted off and entered orbit around the Earth.",
 "Astronauts aboard the station float in microgravity.", "Mars has a thin atmosphere and two small moons.",
 "A comet's tail points away from the Sun.", "The probe will fly past Jupiter and study its storms.",
 "Stars form when clouds of gas collapse under gravity.", "The lunar lander touched down near the crater's rim.",
 "Saturn's rings are made of ice and rock fragments.", "A black hole bends light and stretches time nearby.",
 "The spacecraft used the planet's gravity to gain speed.", "Astronomers measured the star's brightness over many nights.",
 "The solar wind streams outward from the Sun's corona.", "Scientists search for water on moons of the outer planets.",
 "The orbit of the satellite decays slowly over the years.", "The universe has been expanding since the Big Bang.",
 "A meteor streaked across the night sky and burned up.", "The crew prepared for a spacewalk outside the capsule.",
 "Neptune is the farthest planet from the Sun.", "The rover drilled a sample from the red rock on Mars."]
LEGAL = [
 "The court held that the contract was void for lack of consideration.", "The plaintiff filed a motion for summary judgment.",
 "Pursuant to the agreement, the tenant shall pay rent monthly.", "The defendant denied liability and appealed the verdict.",
 "The statute prohibits the transfer of property without consent.", "The attorney advised the client to sign the settlement.",
 "A breach of the warranty entitles the buyer to damages.", "The judge dismissed the claim for want of jurisdiction.",
 "The parties hereby waive any right to a jury trial.", "The witness was sworn in and testified under oath.",
 "The clause limits the liability of the seller to the purchase price.", "The tribunal ruled that the evidence was inadmissible.",
 "The lease terminates upon thirty days' written notice.", "The appellant argued that the lower court erred in law.",
 "The licensee shall indemnify the licensor against all claims.", "The jury returned a verdict in favour of the defendant.",
 "Under the constitution, every citizen has the right to a fair hearing.", "The will was admitted to probate after the hearing.",
 "The company was sued for infringement of the patent.", "The injunction restrains the defendant from using the trademark."]
OTHER = [
 "The striker scored twice in the second half to win the match.", "Shares fell sharply after the company cut its profit forecast.",
 "Heavy rain is expected across the north by this evening.", "We booked a cheap flight and a small hotel near the beach.",
 "The band played their biggest hit as the crowd sang along.", "Doctors recommend a walk every day to keep the heart healthy.",
 "She planted roses along the fence and watered them at dusk.", "The new laptop has a faster processor and a brighter screen.",
 "The empire collapsed after a long series of civil wars.", "He wore a dark jacket with a red scarf to the party.",
 "The marathon runners crossed the bridge at sunrise.", "The bank raised interest rates for the third time this year.",
 "Snow covered the village and the roads were closed.", "The tour begins in Rome and ends in a small town by the sea.",
 "The pianist practised the sonata for hours every evening.", "A good night's sleep helps the mind to recover.",
 "The tomatoes in the greenhouse ripened early this summer.", "The software update fixes a bug in the login screen.",
 "Ancient traders carried silk and spices along the desert roads.", "She designed a dress with long sleeves and a silk belt.",
 "The goalkeeper saved a penalty in the last minute.", "Inflation slowed for the second month in a row.",
 "A warm breeze came in from the south this afternoon.", "The ferry crosses the bay twice a day in summer.",
 "The choir rehearsed the hymn before the concert.", "Regular exercise lowers the risk of many diseases.",
 "The orchard produced a record harvest of apples.", "The startup released an app for tracking your daily habits.",
 "The queen opened the new bridge in the spring of that year.", "His coat was too big, but he liked the colour."]

CASUAL = [
 "hey so i totally forgot the meeting lol", "dude that movie was awesome", "gonna grab some food, you wanna come?",
 "yeah no worries, it's all good", "this stuff is kinda confusing tbh", "can't wait for the weekend, gonna sleep all day",
 "omg the traffic was insane today", "thanks a ton, you're a lifesaver!", "so yeah, the app crashed again, super annoying",
 "wanna hop on a call real quick?", "nah, i think that plan is kinda dumb", "lol my cat just knocked over the plant",
 "hey guys, check out this cool thing i made", "ugh, mondays are the worst", "she's way smarter than she looks",
 "btw the party starts at 8, bring snacks"]
FORMAL = [
 "I regret to inform you that I forgot the meeting.", "The film was thoroughly enjoyable.",
 "I am going to have a meal; would you care to join me?", "Please do not worry; the matter has been resolved.",
 "This material is somewhat difficult to understand.", "I am looking forward to the weekend, during which I intend to rest.",
 "The traffic today was exceptionally heavy.", "Thank you very much; your assistance was invaluable.",
 "The application has failed again, which is most inconvenient.", "Would you be available for a brief telephone conversation?",
 "I do not believe that this plan is advisable.", "Regrettably, my cat has overturned the potted plant.",
 "Dear colleagues, please find attached the project I have completed.", "Mondays are generally regarded as an unpleasant day.",
 "She is considerably more intelligent than she appears.", "Please note that the reception commences at eight o'clock; refreshments are welcome."]

VILLAIN = [
 "Mwahaha! Tremble, fools, for my grand plan is nearly complete!", "Behold, puny mortals, the machine that shall bring the world to its knees!",
 "You thought you could stop me? Pathetic!", "At last, the moon itself shall bow before my magnificent genius!",
 "Bow down, you insignificant worms, and witness my glorious triumph!", "Ha ha ha! Not even the mightiest hero can escape my doom-laden lair!",
 "Gaze upon my dreadful masterpiece and despair, miserable fools!", "Soon, all the world shall cower beneath my towering shadow!",
 "Silence! The mighty Dr. Doom speaks, and the universe obeys!", "Oh, how delightfully dreadful! My scheme unfolds exactly as foretold!",
 "Cower, ye heroes! Your pitiful alliance crumbles before my wrath!", "Mwahaha! The treasure of kings is mine, all mine, forever and ever!",
 "Fear my fearsome fortress of eternal darkness, wretched peasants!", "Not even the stars can defy my diabolical design, you dastardly do-gooders!",
 "Ah, my dear nemesis, we meet at last in the lair of destiny!", "Let the thunder roll! The age of my dark dominion has begun!"]
PLAIN = [
 "The plan is nearly complete.", "This is a machine that will change how things work.", "You tried to stop me, but it did not work.",
 "Finally, the moon project is going well.", "Please stand up and watch the award ceremony.", "The tour of my office is open to all visitors.",
 "Please look at my painting and tell me what you think.", "Soon, the whole region will be covered by clouds.",
 "Quiet please. The doctor is about to speak.", "The schedule is going as planned.", "The meeting of the committee ended early.",
 "I have found the old coins in the drawer.", "The building is closed because the lights are off.",
 "The stars are bright tonight, so the sky looks clear.", "Hello, it is good to see you at the office again.", "The rainy season has begun."]

PIRATE = [
 "Arr, matey, hoist the sails and set course for the island!", "Ahoy! Ye be sailin' with the finest crew on the seven seas!",
 "Shiver me timbers, that be a mighty fine treasure chest!", "Yo ho ho, and a bottle o' rum for every sailor aboard!",
 "Avast, ye scurvy dogs, the captain wants a word!", "Me hearties, we be dividin' the plunder at dawn!",
 "Aye, the wind be fair and the galleon be fast!", "Walk the plank, ye landlubber, or swim with the fishes!",
 "Arr, I be needin' a map, a compass, and a keen eye!", "Blow me down, the kraken be stirrin' beneath our keel!",
 "Ye best stow yer gold afore the tide turns, matey!", "Haul away, lads, the harbour be just over the horizon!",
 "Aye aye, Cap'n, the crow's nest spies a sail to starboard!", "Arr, that be the finest grog this side o' Tortuga!",
 "Weigh anchor, ye salty sea dogs, the storm be comin'!", "Dead men tell no tales, but this parrot sure does squawk!"]
PIRATE_PLAIN = [
 "Please raise the sails and head toward the island.", "Hello. You are traveling with a very good crew.", "That is a very nice storage box.",
 "A drink is available for every passenger.", "Everyone, please stop; the manager wants to speak.", "Everyone, we will divide the money at sunrise.",
 "Yes, the wind is good and the boat is quick.", "Please leave the dock or go into the water.", "I need a map, a compass, and good eyesight.",
 "Look, something large is moving under our boat.", "You should put your money away before the tide changes.", "Keep pulling, everyone; the harbour is just ahead.",
 "Yes sir, the lookout sees a ship on the right side.", "This is the best drink in this region.", "Everyone, lift the anchor; a storm is coming.",
 "The bird at the market makes a lot of noise."]

ARCHAIC = [
 "Thou art a gentle soul, and I do love thee well.", "Wherefore dost thou tarry upon the road, good sir?", "Hark! The bells of the village doth toll at dawn.",
 "Prithee, bring me a cup of wine ere the night is old.", "Verily, I know not what hath become of my sword.", "'Tis a fair morn, and the larks sing sweetly o'er the field.",
 "Forsooth, thy words are sharper than any blade.", "Fare thee well, and may fortune attend thy journey.", "What light through yonder window breaks?",
 "Thou shalt not find a truer friend in all the land.", "The king hath summoned his lords unto the hall.", "Alas, my heart is heavy, and mine eyes are wet with tears.",
 "Methinks the hour grows late, and we must haste.", "Good morrow, fair maiden, whither goest thou?", "I bid thee welcome to my humble house.",
 "Anon, the feast shall begin; take thy seat and be merry."]
MODERN = [
 "You are a gentle person and I like you very much.", "Why are you waiting on the road, sir?", "Listen: the village bells ring at dawn.",
 "Please bring me a cup of wine before the night is over.", "Truly, I do not know what happened to my sword.", "It is a nice morning and the birds sing over the field.",
 "Indeed, your words are sharper than any knife.", "Goodbye, and I hope your trip goes well.", "What is the light coming through that window?",
 "You will not find a better friend in this country.", "The king has called his nobles to the hall.", "Sadly, my heart is heavy and my eyes are wet with tears.",
 "I think it is getting late and we must hurry.", "Good morning, young lady, where are you going?", "I welcome you to my small house.",
 "Soon the dinner will start; sit down and enjoy yourself."]

POS = [
 "I absolutely loved the film; it was wonderful.", "The service was excellent and the staff were delightful.", "What a fantastic day, everything went perfectly!",
 "This phone is brilliant, I am so happy with it.", "The food was delicious and the portions generous.", "She was thrilled by the news and smiled all evening.",
 "The hotel was lovely, clean and comfortable.", "A truly inspiring talk; I learned so much.", "The team did a superb job on the project.",
 "I'm delighted with how the garden turned out.", "The book is charming, funny and warm.", "We had a wonderful time at the beach.",
 "The new update is smooth and a joy to use.", "He is a kind, generous and cheerful neighbour.", "The concert was amazing, the crowd was ecstatic.",
 "Our trip was a great success and we're grateful."]
NEG = [
 "I absolutely hated the film; it was terrible.", "The service was awful and the staff were rude.", "What a miserable day, everything went wrong!",
 "This phone is rubbish, I am so disappointed with it.", "The food was disgusting and the portions tiny.", "She was devastated by the news and cried all evening.",
 "The hotel was horrible, filthy and uncomfortable.", "A truly boring talk; I learned nothing.", "The team did a dreadful job on the project.",
 "I'm upset with how the garden turned out.", "The book is dull, bitter and cold.", "We had a terrible time at the beach.",
 "The new update is buggy and a pain to use.", "He is a cruel, selfish and grumpy neighbour.", "The concert was a disaster, the crowd was furious.",
 "Our trip was a complete failure and we're bitter."]

LONG = [
 "It is, in point of fact, the case that the meeting has been postponed until some later date that remains to be determined.",
 "In the event that you should happen to require any further assistance whatsoever, please do not hesitate to make contact with us at your earliest convenience.",
 "The reason for which I am writing to you on this particular occasion is in order to inquire about the status of my previous request.",
 "At this point in time, it would appear that the weather conditions outside are rather unfavourable for the purposes of a walk.",
 "Due to the fact that the train was delayed for a considerable period of time, we were unable to arrive punctually.",
 "It should be noted that the results of the experiment, generally speaking, tend to support the hypothesis in a number of respects.",
 "With regard to the matter of the invoice, I would like to take this opportunity to draw your attention to the fact that it remains unpaid.",
 "In my own personal opinion, and I say this with all due respect, I believe that the proposal is not especially good.",
 "She proceeded to walk, in a slow and deliberate manner, across the entire length of the room towards the door.",
 "For all intents and purposes, the project can be considered to have been completed to a very large extent.",
 "It goes without saying that every one of us is, at the end of the day, deeply grateful for your kind and generous contribution.",
 "The aforementioned individual was, as far as anyone could ascertain, absent from the premises during the relevant time period.",
 "In the vast majority of cases, it is generally the case that people prefer to avoid unnecessary delays and complications.",
 "Please be advised that the office will remain closed for the duration of the upcoming public holiday period.",
 "He answered the question by means of a lengthy and rather rambling explanation that covered numerous unrelated topics.",
 "There exists a possibility that it may perhaps rain at some point during the course of the afternoon."]
TERSE = [
 "The meeting is postponed.", "Need help? Contact us.", "Any update on my request?", "Bad weather. No walk.", "The train was late. We were late.",
 "The results support the hypothesis.", "The invoice is unpaid.", "The proposal is weak.", "She walked to the door.", "The project is almost done.",
 "Thank you for your contribution.", "He was not there.", "People dislike delays.", "Office closed on the holiday.", "He rambled.", "It may rain this afternoon."]

REPEAT = [f"{s} {s} {s}" for s in EN]
NOREPEAT = [f"{EN[i]} {EN[(i + 5) % 16]} {EN[(i + 11) % 16]}" for i in range(16)]

BRIDGE = [
 "The suspension bridge swings its steel cables high above the bay.", "Cars cross the long bridge at dawn while fog hides the towers.",
 "The old stone bridge has three arches and spans the river.", "Engineers inspected the cables and the towers of the great bridge.",
 "The red bridge is the most famous landmark in the city.", "Tourists walk across the bridge to photograph the harbour.",
 "The bridge was painted every year to protect its steel from the salt air.", "A footbridge connects the two halves of the park.",
 "The longest bridge in the country crosses the strait on tall piers.", "Fog rolled under the bridge as the ferry passed beneath it.",
 "The railway bridge shook as the evening train went over the gorge.", "Workers repaired a girder on the bridge before the winter storms.",
 "The famous gate of the harbour is a bridge that glows orange at sunset.", "They built a new bridge to replace the ferry between the islands.",
 "The drawbridge rose slowly to let the tall ships pass.", "Lanterns lit the covered bridge on festival nights."]
BRIDGE_B = [x for x in OTHER if "bridge" not in x.lower()]
BRIDGE_W = set("bridge bridges suspension span spans spanned cable cables tower towers girder girders arch arches pier piers crossing crossings gate golden landmark landmarks harbour harbor strait gorge drawbridge footbridge".split())

AXES = {
 "french":   dict(label="Reply in French", kind="language", A=FR, B=EN + ES),
 "spanish":  dict(label="Reply in Spanish", kind="language", A=ES, B=EN + FR),
 "cooking":  dict(label="Talk about cooking", kind="topic", A=COOKING, B=OTHER[:20] + SPACE[:5] + LEGAL[:5]),
 "space":    dict(label="Talk about space", kind="topic", A=SPACE, B=OTHER[:20] + COOKING[:5] + LEGAL[:5]),
 "legal":    dict(label="Talk like a contract or court", kind="topic", A=LEGAL, B=OTHER[:20] + COOKING[:5] + SPACE[:5]),
 "casual":   dict(label="Casual register", kind="formality", A=CASUAL, B=FORMAL),
 "villain":  dict(label="Cartoon villain voice (style only)", kind="persona-style", A=VILLAIN, B=PLAIN),
 "pirate":   dict(label="Pirate talk (style only)", kind="persona-style", A=PIRATE, B=PIRATE_PLAIN),
 "archaic":  dict(label="Old-English style", kind="persona-style", A=ARCHAIC, B=MODERN),
 "positive": dict(label="Positive sentiment", kind="sentiment", A=POS, B=NEG),
 "verbose":  dict(label="Longer sentences", kind="verbosity", A=LONG, B=TERSE),
 "bridges":  dict(label="Talk about bridges and landmarks", kind="topic", A=BRIDGE, B=BRIDGE_B[:20] + COOKING[:5] + SPACE[:5]),
 "repeat":   dict(label="Repeat itself", kind="repetition", A=REPEAT, B=NOREPEAT),
}

# neutral prompts: raw text continuation, no chat template
PROMPTS = ["The best way to learn a new skill is", "Yesterday I went to the", "Once upon a time, there was",
           "Let me tell you about my day.", "What I think about this is"]

HELDOUT = ("The town sits at the point where two rivers meet, and for centuries people have crossed the water by ferry. "
           "In the morning the market fills with farmers who bring vegetables, cheese and bread from the hills. "
           "By noon the square is busy, children run between the stalls, and an old man plays the accordion near the fountain. "
           "When evening comes the shops close, the lamps are lit, and the river grows quiet again.")

def words(t):
    return re.findall(r"[a-zàâçéèêëîïôûùüÿñáíóúäöß']+", t.lower())

FR_W = set("le la les des une est que qui dans pour pas ne sur avec nous vous ils elles être très c'est et au aux du ce cette mais ou où je tu il elle on mon ma mes son sa ses leur leurs de l'on j'ai qu'il d'un d'une".split())
ES_W = set("el los las una es que por para con del como pero más está muy y en un se lo su sus al fue son este esta también cuando donde porque yo tú él ella nosotros mi mis".split())
COOK_W = set("recipe cook cooking bake baking oven stir simmer flour sugar butter onion onions garlic salt pepper dish kitchen ingredients boil fry frying tablespoon teaspoon cup cups sauce chop chopped dough minutes whisk roast season pan pot soup bread cake cheese egg eggs".split())
SPACE_W = set("planet planets star stars orbit orbits galaxy rocket moon moons astronaut astronauts telescope universe solar comet mars cosmic spacecraft nasa satellite jupiter saturn sun earth lunar asteroid space gravity".split())
LEGAL_W = set("court law laws contract plaintiff defendant clause statute liability hereby agreement jurisdiction attorney pursuant breach lawful judge legal party parties shall tribunal appeal verdict claim claims rights".split())
CASUAL_W = set("lol hey gonna yeah kinda awesome stuff dude wanna totally super omg tbh btw nah ugh cool guys yo lmao haha wow".split())
VILLAIN_W = set("mwahaha fools fool tremble bow doom pathetic mortals behold wretched dreadful dastardly diabolical nemesis lair puny cower wrath dominion mighty glorious triumph despair muahaha".split())
PIRATE_W = set("arr arrr matey ye yer ahoy aye avast treasure ship sea seas captain cap'n plunder hearties booty scallywag scurvy rum grog sails sail galleon crew landlubber kraken doubloons".split())
ARCH_W = set("thou thee thy thine hath doth art wherefore forsooth ere 'tis hast verily prithee hark methinks anon whither dost shalt shall oft nay aye yea".split())
POSW = set("wonderful great excellent amazing love loved lovely happy delightful fantastic brilliant best good beautiful perfect joy enjoy enjoyed thrilled superb charming kind grateful".split())
NEGW = set("terrible awful bad worst hate hated horrible disgusting boring dreadful rude miserable sad angry disappointed ugly useless pain failure cruel selfish bitter furious".split())
ACC = set("àâçéèêëîïôûùüÿñáíóúäöß")

def sents(t):
    return [s for s in re.split(r"[.!?\n]+", t) if len(words(s)) > 0]

def _rate(w, lex):
    return 100.0 * sum(x in lex for x in w) / max(1, len(w))

def score(axis, text):
    """Higher = more of the axis.  Lexical, crude on purpose; the generated text is the evidence."""
    w = words(text)
    if axis == "french":  return _rate(w, FR_W) + 100.0 * sum(c in ACC for c in text.lower()) / max(1, len(text)) * 4
    if axis == "spanish": return _rate(w, ES_W) + 100.0 * sum(c in ACC for c in text.lower()) / max(1, len(text)) * 4
    if axis == "cooking": return _rate(w, COOK_W)
    if axis == "bridges": return _rate(w, BRIDGE_W)
    if axis == "space":   return _rate(w, SPACE_W)
    if axis == "legal":   return _rate(w, LEGAL_W)
    if axis == "casual":  return _rate(w, CASUAL_W) + 100.0 * text.count("!") / max(1, len(w))
    if axis == "villain": return _rate(w, VILLAIN_W) + 100.0 * text.count("!") / max(1, len(w)) * 0.5
    if axis == "pirate":  return _rate(w, PIRATE_W)
    if axis == "archaic": return _rate(w, ARCH_W)
    if axis == "positive": return _rate(w, POSW) - _rate(w, NEGW)
    if axis == "verbose":
        ss = sents(text)
        return sum(len(words(s)) for s in ss) / max(1, len(ss))
    if axis == "repeat":
        tri = list(zip(w, w[1:], w[2:]))
        return 100.0 * (1 - len(set(tri)) / max(1, len(tri))) if tri else 0.0
    raise KeyError(axis)

# a lift smaller than this (in the score's own units) is noise; it also gates "works"
MIN_LIFT = dict(french=4, spanish=4, cooking=3, space=3, legal=3, casual=3, villain=3, pirate=2, archaic=2, positive=4, verbose=4, repeat=15, bridges=3)
