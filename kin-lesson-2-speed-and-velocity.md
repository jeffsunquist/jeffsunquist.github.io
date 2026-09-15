---
theme: default
colorSchema: light
title: Kinematics — Speed and Velocity
info: |
  Grade 6–7 Physics · KIN · Lesson 2 of 4
fonts:
  sans: Patrick Hand
  local:
    - Patrick Hand
  provider: none
learning_outcomes:
  - KIN-14
  - KIN-20
  - KIN-21
  - KIN-22
  - KIN-23
  - KIN-24
  - KIN-25
  - KIN-26
  - KIN-27
  - KIN-28
  - KIN-29
  - KIN-30
  - KIN-31
  - KIN-32
  - KIN-33
  - KIN-34
  - KIN-35
  - KIN-36
  - KIN-37
---

# Kinematics — Speed and Velocity

Lesson 2 of 4

---

## Learning Objective

Students will be able to define and calculate speed, average speed, and velocity, and (G7) add velocity vectors to find resultant and relative velocities.

---

## Review: Position and Reference Frames

- **Scalar** = magnitude only; **vector** = magnitude + direction.
- **Position** is described using a coordinate system, which has an origin, axes, units, scale.
- **Distance** is a scalar; **displacement** is a vector.
- A **reference point** is the origin used to measure position.
- How motion is described depends on the **frame of reference**.

---

## Time

_Time_ ($t$) is the duration between two states.
A _state_ defined as the quantities an object has at one moment.


<v-click>

- Change of temperature:
  - A liter of water needed **7 minutes** to change from **19°C** to **100°C**.

</v-click>
<v-click>

- Change of position: 
  - A student walked from the **math classroom** to the **biology classroom** in **120 seconds**.

</v-click>

---

### Kinematic equations that use time


| Grade 6 | Grade 7 |
|-------- | ------- |
| $\bar v=\frac{\Delta x}{\red t}$ | $\bar v=\frac{\Delta x}{\red t}$ |
| $s=\frac{d}{\red t}$ | $s=\frac{d}{\red t}$ |
| $a=\frac{\Delta v}{\red t}=\frac{v-v_0}{\red t}$ | $v=v_0+a\red t$ |
| $\gray{\Delta x=x-x_0}$        | $\Delta x=v_0 \red t + \frac{1}{2}a\red t^2$ |
|         | $\gray{v^2=v_0^2+2a\Delta x}$  |

---

## Speed

- **Speed** is a **scalar** and it tells you how fast something is moving.
- $\mathrm{speed}=\frac{\mathrm{distance}}{\mathrm{time}}$

- $s = \frac{d}{t}$

- example: The speed of the bus is $40 \frac{\mathrm{m}}{\mathrm{s}}$

---

## Speed and Velocity Equations

- **Velocity** is a **vector** and it tells you how fast something is moving and _in what direction_.

- $\mathrm{velocity}=\frac{\mathrm{displacement}}{\mathrm{time}}$

- $v = \frac{\Delta x}{t}$


- example: The velocity of the bus is $40\frac{\mathrm{m}}{\mathrm{s}}\ \mathrm{east}$

---

## Problem Solving Steps

1. **What am I given? What am I finding?**
2. **What equation connects them?**
3. **Plug in and solve.**
4. **Check the units and direction (if applicable).**

---

## Example: Speed

A train travels $2000\ \mathrm{m}$ in $60\ \mathrm{s}$. What is its speed?

<Transform :scale="0.85">
<v-clicks>

1. $d = 2000\ \mathrm{m}$, $t = 60\ \mathrm{s}$, $s = ?$

2. $s = \dfrac{d}{t}$

3. $s = \dfrac{2000\ \mathrm{m}}{60\ \mathrm{s}} = 33.3\ \frac{\mathrm{m}}{\mathrm{s}}$

4. $\frac{m}{s}$✓ scalar✓

</v-clicks>
</Transform>


---

## Example: Distance

A dog runs at a constant speed of $5 \frac{m}{s}$ for a time of $30\ \mathrm{s}$. What is the distance traveled?

<Transform :scale="0.85">
<v-clicks>

1. $s=5 \frac{m}{s}$, $t = 30\ \mathrm{s}$, $d=?$

2. $d = st$

3. $d = 5 \frac{m}{s} \cdot 30\ \mathrm{s} = 150\ \mathrm{m}$ 

4. $\mathrm{m}$✓ scalar✓

</v-clicks>
</Transform>

---

## Example: Velocity

A bird flies $500\ \mathrm{m}$ east in $25\ \mathrm{s}$. What is its velocity?

<Transform :scale="0.85">
<v-clicks>

1. $\Delta x = 500\ \mathrm{m\ east}$, $t = 25\ \mathrm{s}$, $v=?$

2. $v = \dfrac{\Delta x}{t}$

3. $v = \dfrac{500\ \mathrm{m}}{25\ \mathrm{s}} = 20\ \frac{\mathrm{m}}{\mathrm{s}}\ \mathrm{east}$

4. $\frac{\mathrm{m}}{\mathrm{s}}$✓ east✓

</v-clicks>
</Transform>

---

## Example: Displacement

A balloon floats upward at a constant velocity of $2.5\frac{\mathrm{m}}{\mathrm{s}}$ for a time of $20\ \mathrm{s}$. What is its displacement?

<Transform :scale="0.85">
<v-clicks>

1. $v=2.5\frac{\mathrm{m}}{\mathrm{s}}$, $t = 20\ \mathrm{s}$, $\Delta x = ?$

2. $\Delta x=vt$

3. $\Delta x=2.5\frac{\mathrm{m}}{\mathrm{s}}\cdot20\ \mathrm{s}=50\ \mathrm{m\ up}$

4. $\frac{\mathrm{m}}{\mathrm{s}}$✓ up✓

</v-clicks>
</Transform>

---
class: g7
---

## Resultant Velocity (Same Direction)

A boat moves $3 \frac{\mathrm{m}}{\mathrm{s}}$ east while the current pushes $1 \frac{\mathrm{m}}{\mathrm{s}}$ east.

$$v_{\text{resultant}} = 3\frac{\mathrm{m}}{\mathrm{s}} + 1\frac{\mathrm{m}}{\mathrm{s}} = 4\ \frac{\mathrm{m}}{\mathrm{s}}\ \text{east}$$

---
class: g7
---

## Resultant Velocity (Opposite Direction)

A swimmer moves $3 \frac{\mathrm{m}}{\mathrm{s}}$ east against a current of $1 \frac{\mathrm{m}}{\mathrm{s}}$ west.

$$v_{\text{resultant}} = 3\frac{\mathrm{m}}{\mathrm{s}} - 1\frac{\mathrm{m}}{\mathrm{s}} = 2\ \frac{\mathrm{m}}{\mathrm{s}}\ \text{east}$$

---
class: g7
---

## Relative Velocity

A passenger walks forward at $1 \frac{\mathrm{m}}{\mathrm{s}}$ on a train moving at $10 \frac{\mathrm{m}}{\mathrm{s}}$.

<v-clicks>

- Relative to the **train**:
   - the passenger moves at $1 \frac{\mathrm{m}}{\mathrm{s}}$.
- Relative to the **ground**: 
   - the passenger moves at $10\frac{\mathrm{m}}{\mathrm{s}} + 1\frac{\mathrm{m}}{\mathrm{s}} = 11 \frac{\mathrm{m}}{\mathrm{s}}$.

</v-clicks>

---

## Summary

- **Speed** = how fast (scalar); **velocity** = how fast and which way (vector).
- $s = \dfrac{d}{t}$ and $v = \dfrac{\Delta x}{t}$
- Units of speed and velocity: $\frac{\mathrm{m}}{\mathrm{s}}$.
- **Collinear velocity vectors**: add when the same direction, subtract when opposite.
- Relative velocity depends on the **frame of reference**.
