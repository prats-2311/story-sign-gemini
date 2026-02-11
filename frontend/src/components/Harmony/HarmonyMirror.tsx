import { HarmonySession } from '../HarmonySession';

export function HarmonyMirror() {
    return <HarmonySession emotion="HAPPY" onExit={() => console.log('Exit Mirror')} />;
}
