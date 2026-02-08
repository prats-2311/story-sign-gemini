export interface ASLWord {
    word: string;
    hint: string;
}

export interface ASLLevel {
    id: string;
    title: string;
    description: string;
    icon: string; // Emoji for now
    color: string;
    status: 'locked' | 'unlocked' | 'completed';
    stars: number; // 0-3
    words: ASLWord[]; // Vocabulary to learn
}

export const ASL_LEVELS: ASLLevel[] = [
    {
        id: 'basics_1',
        title: 'The Basics',
        description: 'Learn to say Hello and introduce yourself.',
        icon: '👋',
        color: 'from-blue-400 to-blue-600',
        status: 'unlocked',
        stars: 0,
        words: [
            { word: 'HELLO', hint: 'Wave your open hand near your forehead, moving outward like a salute.' },
            { word: 'MY', hint: 'Place your flat palm against your chest.' },
            { word: 'NAME', hint: 'Tap your index and middle fingers of both hands together in an X shape.' },
            { word: 'NICE', hint: 'Slide your right palm across your left plam from wrist to fingertips.' },
            { word: 'MEET', hint: 'Bring your two index fingers together vertically (knuckles facing), like two people meeting.' },
            { word: 'YOU', hint: 'Point your index finger directly forward.' }
        ]
    },
    {
        id: 'animals_1',
        title: 'Forest Friends',
        description: 'Meet the animals of the forest.',
        icon: '🐻',
        color: 'from-green-400 to-green-600',
        status: 'locked',
        stars: 0,
        words: [
            { word: 'BEAR', hint: 'Cross your arms and scratch your shoulders like a bear.' },
            { word: 'RABBIT', hint: 'Hold two fingers up by your head like ears and wiggle them backwards.' },
            { word: 'TREE', hint: 'Rest your right elbow on your left hand and twist your right hand like a tree.' },
            { word: 'BIRD', hint: 'Make a beak with your index finger and thumb by your mouth.' }
        ]
    },
    {
        id: 'food_1',
        title: 'Yummy Time',
        description: 'Learn signs for your favorite foods.',
        icon: '🍎',
        color: 'from-red-400 to-red-600',
        status: 'locked',
        stars: 0,
        words: [
            { word: 'APPLE', hint: 'Twist your knuckle into your cheek.' },
            { word: 'MILK', hint: 'Squeeze your fist like you are milking a cow.' },
            { word: 'COOKIE', hint: 'Twist your clawed hand on your flat palm like a cookie cutter.' },
            { word: 'EAT', hint: 'Bring your squished fingers to your mouth.' }
        ]
    },
    {
        id: 'emotions_1',
        title: 'Feeling Good',
        description: 'Express how you feel.',
        icon: '😊',
        color: 'from-yellow-400 to-yellow-600',
        status: 'locked',
        stars: 0,
        words: [
            { word: 'HAPPY', hint: 'Brush your flat hands up your chest with a smile.' },
            { word: 'SAD', hint: 'Drag your open hand down your face with a sad expression.' },
            { word: 'ANGRY', hint: 'Claw your hand and pull it away from your face with a frown.' },
            { word: 'EXCITED', hint: 'Brush your middle fingers upwards on your chest efficiently.' }
        ]
    }
];
