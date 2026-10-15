import { useEffect, useState } from 'react';
import { Animated } from 'react-native';

/** Gentle scale pulse while an alert is active. */
export function usePulse(active: boolean): Animated.Value {
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!active) {
      pulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.84,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [active, pulse]);

  return pulse;
}
