// Authored bank: Waves. The WAV LOs are Grade 7 only in shared/lo_master.csv.
import { make } from './_make.js';

const g7 = make('WAV', '7');

export default [
  ...g7([
    ['WAV7-01', 'WAV-01', 1, 'What does a mechanical wave need in order to travel?', ['no medium', 'a medium', 'only light', 'a vacuum'], 1, 'Mechanical waves travel through a material medium.'],
    ['WAV7-02', 'WAV-01', 1, 'Where can an electromagnetic wave travel?', ['only solids', 'only water', 'only air', 'a vacuum'], 3, 'Electromagnetic waves do not need a medium.'],
    ['WAV7-03', 'WAV-02', 1, 'How do particles move in a transverse wave?', ['parallel to the wave direction', 'perpendicular to the wave direction', 'only backward', 'not at all'], 1, 'Transverse particle motion is perpendicular to the wave direction.'],
    ['WAV7-04', 'WAV-02', 1, 'How do particles move in a longitudinal wave?', ['perpendicular to the wave direction', 'in circles', 'randomly', 'parallel to the wave direction'], 3, 'Longitudinal particle motion is along the wave direction.'],
    ['WAV7-05', 'WAV-03', 1, 'Sound in air is what kind of wave?', ['transverse electromagnetic', 'longitudinal mechanical', 'longitudinal electromagnetic', 'transverse mechanical'], 1, 'Sound needs air and vibrates particles along its direction of travel.'],
    ['WAV7-06', 'WAV-04', 1, 'Light is what kind of wave?', ['longitudinal mechanical', 'transverse mechanical', 'transverse electromagnetic', 'longitudinal electromagnetic'], 2, 'Light is a transverse electromagnetic wave.'],
    ['WAV7-07', 'WAV-05', 1, 'What is a medium?', ['a type of wave', 'a unit of frequency', 'the material a wave travels through', 'empty space'], 2, 'The medium is the substance that carries the wave.'],
    ['WAV7-08', 'WAV-05', 1, 'What is a vibration?', ['a constant speed', 'a back-and-forth motion', 'a force', 'a medium'], 1, 'Vibration is repeated back-and-forth motion about equilibrium.'],
    ['WAV7-09', 'WAV-06', 1, 'What is wavelength?', ['number of waves per second', 'time for one wave', 'wave height', 'distance between crests'], 3, 'Wavelength is the distance between matching points on consecutive waves.'],
    ['WAV7-10', 'WAV-06', 1, 'What is frequency?', ['distance between crests', 'time for one wave', 'waves per second', 'wave speed'], 2, 'Frequency counts the waves passing a point each second.'],
    ['WAV7-11', 'WAV-06', 2, 'What is the period of a wave?', ['waves per second', 'distance between crests', 'amplitude', 'time for one wave'], 3, 'Period is the time for one complete wave.'],
    ['WAV7-12', 'WAV-07', 2, 'What does a wave transport?', ['matter', 'mass', 'medium', 'energy'], 3, 'Waves transfer energy without carrying the medium along.'],
    ['WAV7-13', 'WAV-08', 2, 'In a transverse wave, the disturbance is what?', ['parallel to energy transfer', 'perpendicular to energy transfer', 'opposite to energy transfer', 'zero'], 1, 'The disturbance is perpendicular to the direction energy travels.'],
    ['WAV7-14', 'WAV-09', 2, 'Ten waves pass a point in 2 s. What is the period?', ['2 s', '0.2 s', '5 s', '10 s'], 1, 'Period = time / number of waves = 2 / 10 = 0.2 s.'],
    ['WAV7-15', 'WAV-10', 2, 'A wave has a frequency of 5 Hz. What is its period?', ['5 s', '1 s', '2 s', '0.2 s'], 3, 'Period = 1 / frequency = 1 / 5 = 0.2 s.'],
    ['WAV7-16', 'WAV-11', 2, 'How is wave speed calculated?', ['wavelength / frequency', 'frequency / wavelength', 'wavelength + frequency', 'wavelength x frequency'], 3, 'Wave speed equals wavelength times frequency.'],
    ['WAV7-17', 'WAV-12', 2, 'What does wave speed depend on?', ['the amplitude', 'the medium', 'the color', 'the source only'], 1, 'The medium determines how fast a wave travels.'],
    ['WAV7-18', 'WAV-13', 2, 'What happens in constructive interference?', ['cancel', 'add together', 'pass through', 'stop'], 1, 'Waves in phase add to make a larger disturbance.'],
    ['WAV7-19', 'WAV-13', 2, 'What happens in destructive interference?', ['add', 'reflect', 'refract', 'cancel'], 3, 'Opposite disturbances combine to reduce or cancel.'],
    ['WAV7-20', 'WAV-14', 2, 'Two identical crests meet. What is the result?', ['zero', 'larger crest', 'smaller crest', 'no wave'], 1, 'Two crests add to form a larger crest.'],
    ['WAV7-21', 'WAV-11', 3, 'A wave has wavelength 2 m and frequency 3 Hz. What is its speed?', ['1.5 m/s', '5 m/s', '6 m/s', '0.67 m/s'], 2, 'v = wavelength x frequency = 2 x 3 = 6 m/s.'],
    ['WAV7-22', 'WAV-10', 3, 'A wave has a period of 0.25 s. What is its frequency?', ['0.25 Hz', '4 Hz', '2 Hz', '25 Hz'], 1, 'Frequency = 1 / period = 1 / 0.25 = 4 Hz.'],
    ['WAV7-23', 'WAV-09', 3, 'Twenty waves pass a point in 4 s. What is the frequency?', ['20 Hz', '4 Hz', '0.2 Hz', '5 Hz'], 3, 'Frequency = 20 / 4 = 5 Hz.'],
    ['WAV7-24', 'WAV-11', 3, 'A wave travels at 10 m/s with a frequency of 2 Hz. What is its wavelength?', ['20 m', '0.2 m', '5 m', '2 m'], 2, 'Wavelength = speed / frequency = 10 / 2 = 5 m.'],
    ['WAV7-25', 'WAV-12', 3, 'Sound travels fastest through which medium?', ['air', 'vacuum', 'steel', 'water'], 2, 'Sound travels fastest in stiff solids such as steel.'],
    ['WAV7-26', 'WAV-08', 3, 'In a longitudinal wave, particle motion is what?', ['perpendicular', 'parallel to energy transfer', 'opposite', 'random'], 1, 'Particles oscillate along the direction of energy transfer.'],
    ['WAV7-27', 'WAV-02', 3, 'Which wave is longitudinal?', ['light', 'sound', 'radio', 'x-ray'], 1, 'Sound is a longitudinal wave.'],
    ['WAV7-28', 'WAV-04', 3, 'Which wave is electromagnetic?', ['sound', 'water wave', 'light', 'seismic P wave'], 2, 'Light is an electromagnetic wave.'],
    ['WAV7-29', 'WAV-13', 3, 'A crest meets an equal trough. What is the result?', ['double crest', 'double trough', 'zero displacement', 'a new wave'], 2, 'Equal opposite displacements cancel.'],
    ['WAV7-30', 'WAV-07', 3, 'A wave passes through a medium. What do the particles do?', ['move with the wave', 'disappear', 'stop', 'oscillate but do not travel with the wave'], 3, 'The medium vibrates in place while energy moves through it.'],
  ]),
];
