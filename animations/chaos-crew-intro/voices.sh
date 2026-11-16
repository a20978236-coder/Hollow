#!/usr/bin/env bash
# Dialogue: one distinct synthetic voice per character (espeak-ng + mbrola, all local, no copyrighted audio).
set -e; cd "$(dirname "$0")/audio"
mk(){ name=$1 voice=$2 speed=$3 pitch=$4 shift=$5 text=$6 gain=$7
  espeak-ng -v $voice -s $speed -p $pitch -a 180 -w raw_$name.wav "$text"
  # pitch-shift for character, warm EQ, gentle drive, trim silence, normalize, 44.1k mono
  sox raw_$name.wav -r 44100 -c 1 $name.wav gain -6 pitch $shift tempo 1.0 bass +3 treble +2 overdrive 4 10 silence 1 0.02 0.5% reverse silence 1 0.02 0.5% reverse norm -1 gain $gain
  printf '%-7s %ss  "%s"\n' $name "$(soxi -D $name.wav)" "$text"; }
mk luck   mb-us2 165 55  250  "What is that ticking noise?" -1
mk hollow mb-us3 115 35  -150 "RUN!"                        0
mk light  mb-us1 120 75  350  "Why?"                        -1
mk echo   mb-us1 190 60  -50  "Because we set off a bomb!"  -1
