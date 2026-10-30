# Physics — Grade 6 Formula Sheet

## SI Base Units

| Quantity | Unit | Symbol |
| --- | --- | --- |
| length / distance | meter | $\mathrm{m}$ |
| mass | kilogram | $\mathrm{kg}$ |
| time | second | $\mathrm{s}$ |
| electric current | ampere | $\mathrm{A}$ |
| temperature | kelvin | $\mathrm{K}$ |
| amount of substance | mole | $\mathrm{mol}$ |
| luminous intensity | candela | $\mathrm{cd}$ |

## Metric Prefixes

| Power | Prefix | Power | Prefix |
| --- | --- | --- | --- |
| $10^{12}$ | T tera | $10^{-1}$ | d deci |
| $10^{9}$ | G giga | $10^{-2}$ | c centi |
| $10^{6}$ | M mega | $10^{-3}$ | m milli |
| $10^{3}$ | k kilo | $10^{-6}$ | µ micro |
| $10^{2}$ | h hecto | $10^{-9}$ | n nano |
| $10^{1}$ | da deka | $10^{-12}$ | p pico |

- No prefix $=10^{0}=1$ (the base unit).

## Scientific Notation

$$a \times 10^{n}$$

- **Big** number → decimal moves **left** → **positive** $n$.
- **Small** number → decimal moves **right** → **negative** $n$.
- A prefix is just a power of ten: kilo $=10^{3}$, nano $=10^{-9}$.

$9{,}300{,}000 = 9.3\times10^{6}$ &nbsp; $0.0000045 = 4.5\times10^{-6}$

## Unit Conversion

Multiply by fractions equal to $1$; cancel unwanted units.

$$5\ \cancel{\mathrm{km}}\left(\frac{1000\ \mathrm{m}}{1\ \cancel{\mathrm{km}}}\right)=5000\ \mathrm{m}$$

> [!IMPORTANT] Speed units
> $\dfrac{\mathrm{km}}{\mathrm{h}} \div 3.6 = \dfrac{\mathrm{m}}{\mathrm{s}}$ &nbsp;&nbsp; $\dfrac{\mathrm{m}}{\mathrm{s}} \times 3.6 = \dfrac{\mathrm{km}}{\mathrm{h}}$
> $40\ \frac{\mathrm{km}}{\mathrm{h}} = 40 \times \dfrac{1000}{3600} = 11.1\ \frac{\mathrm{m}}{\mathrm{s}}$

Common: $1\ \mathrm{km}=1000\ \mathrm{m}$ · $1\ \mathrm{h}=3600\ \mathrm{s}$ · $1\ \mathrm{min}=60\ \mathrm{s}$ · $1\ \mathrm{kg}=1000\ \mathrm{g}$

## Derived & Special Units

| Quantity | Formula | Base units | Name |
| --- | --- | --- | --- |
| Force | $F = ma$ | $\mathrm{kg\cdot m/s^2}$ | Newton (N) |
| Energy / Work | $W = Fd$ | $\mathrm{kg\cdot m^2/s^2}$ | Joule (J) |
| Power | $P = W/t$ | $\mathrm{kg\cdot m^2/s^3}$ | Watt (W) |
| Frequency | $f = 1/T$ | $1/\mathrm{s}$ | Hertz (Hz) |
| Charge | $Q = It$ | $\mathrm{A\cdot s}$ | Coulomb (C) |

## Symbols & Definitions

| Quantity | Symbol | Unit | S/V |
| --- | --- | --- | --- |
| position | $x$ | $\mathrm{m}$ | V |
| distance | $d$ | $\mathrm{m}$ | S |
| displacement | $\Delta x$ | $\mathrm{m}$ | V |
| time | $t$ | $\mathrm{s}$ | S |
| speed | $s$ | $\mathrm{m/s}$ | S |
| velocity | $v$ | $\mathrm{m/s}$ | V |
| acceleration | $a$ | $\mathrm{m/s^2}$ | V |
| mass | $m$ | $\mathrm{kg}$ | S |
| force | $F$ | $\mathrm{N}$ | V |
| net force | $F_{\text{net}}$ | $\mathrm{N}$ | V |
| weight | $W$ | $\mathrm{N}$ | V |
| friction | $f$ | $\mathrm{N}$ | V |
| gravity | $g$ | $9.8\ \mathrm{m/s^2}$ | V |

S = scalar, V = vector.

## Scalars & Vectors

- **Scalar** — magnitude only (mass, time, distance, speed).
- **Vector** — magnitude **and** direction (position, displacement, velocity, acceleration, force).
- Collinear vectors (same axis): **same** direction → **add**; **opposite** → **subtract**.

<div class="fig-row">
<img src="/public/adding_vectors.excalidraw.svg" />
</div>

| Direction | Sign |
| --- | --- |
| right / east / up / north | $+$ |
| left / west / down / south | $-$ |

<!-- page -->

## Kinematics

- Distance $d$ = total path length (scalar). Displacement $\Delta x$ = change in position (vector).
- $\Delta x = x - x_{0}$ &nbsp; ($x$ final, $x_0$ initial position)
- Speed: $s = \dfrac{d}{t}$
- Velocity: $v = \dfrac{\Delta x}{t}$
- Average speed $= \dfrac{d_{\text{total}}}{t_{\text{total}}}$ &nbsp; Average velocity $= \dfrac{\Delta x_{\text{total}}}{t_{\text{total}}}$
- Acceleration: $a = \dfrac{\Delta v}{t} = \dfrac{v - v_{0}}{t}$

> [!TIP] Position–time graph
> The **slope** of a position–time graph is the **velocity**.
> Positive slope → $+v$; negative slope → $-v$; flat line → at rest.

## Forces

- **Newton's 1st law:** an object keeps its motion unless a **net force** acts.
- **Newton's 2nd law:** $F_{\text{net}} = ma$ (acceleration is in the direction of the net force).
- **Newton's 3rd law:** for every action there is an equal and opposite reaction (on two different objects).
- **Net force:** $F_{\text{net}} = \sum F$ (add same direction, subtract opposite).
- **Weight:** $W = mg$, with $g = 9.8\ \mathrm{m/s^2}$ on Earth.
- **Equilibrium:** $F_{\text{net}} = 0 \Rightarrow a = 0 \Rightarrow$ constant velocity (may be zero — at rest).
- **Drag** increases with speed; at **terminal velocity** drag $=$ weight, so $F_{\text{net}} = 0$.

$$1\ \mathrm{N} = 1\ \mathrm{kg\cdot \dfrac{m}{s^2}}$$

## Free-Body Diagrams

Draw every force acting on **one** object as a labeled arrow from a dot.
Include only forces **on** the object; arrow length = magnitude, head = direction.

<svg viewBox="0 0 220 150" width="100%" role="img" aria-label="free-body diagram">
<defs><marker id="fbdarrow" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#111827"/></marker></defs>
<circle cx="110" cy="78" r="6" fill="#111827"/>
<line x1="110" y1="78" x2="110" y2="22" stroke="#111827" stroke-width="2" marker-end="url(#fbdarrow)"/>
<text x="116" y="30" font-size="13" fill="#111827">N</text>
<line x1="110" y1="78" x2="110" y2="138" stroke="#111827" stroke-width="2" marker-end="url(#fbdarrow)"/>
<text x="116" y="134" font-size="13" fill="#111827">W = mg</text>
<line x1="110" y1="78" x2="198" y2="78" stroke="#111827" stroke-width="2" marker-end="url(#fbdarrow)"/>
<text x="176" y="72" font-size="13" fill="#111827">F</text>
<line x1="110" y1="78" x2="32" y2="78" stroke="#111827" stroke-width="2" marker-end="url(#fbdarrow)"/>
<text x="26" y="72" font-size="13" fill="#111827">f</text>
</svg>

## Simple Machines

A machine changes the **size** or **direction** of a force (not the total work).
**Lever · Wheel & axle · Pulley · Wedge · Screw · Inclined plane.**

## Problem-Solving Steps

1. Annotate: what is given? what is the unknown?
2. What equation connects the quantities?
3. Plug in with units and solve.
4. Check the units and direction.

> [!TIP] Hints
> "Starts from rest" → $v_0 = 0$. &nbsp; "Comes to rest" → $v = 0$.
> Give a direction for every vector quantity.
