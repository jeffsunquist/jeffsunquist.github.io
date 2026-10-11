---
theme: default
colorSchema: light
title: Scientific Inquiry — Base Units & Derived Units
info: |
  Grade 6–7 Physics · Lesson 3 of 6
fonts:
  sans: Patrick Hand
  local:
    - Patrick Hand
  provider: none
learning_outcomes:
  - MEAS-04
  - MEAS-01
  - MEAS-02
  - MEAS-03
  - MEAS-05
---

# Scientific Inquiry — Base Units & Derived Units

Lesson 3 of 6

Distinguish base units from derived units and derive the unit of a quantity from its formula.

---
zoom: 0.9
---

## Review: Measurements and the Metric System


**Measurement** = comparing an unknown quantity to a known quantity.

**Accuracy** = how close the average is to the actual value.

**Precision** = how close the measurements are to each other.

**Metric prefixes** are powers of 10 — each prefix is a shortcut for scientific notation.

**Scientific notation**: $a \times 10^{n}$, where $n$ moves the decimal point.

**Unit conversion**: multiply by fractions equal to 1 so unwanted units cancel.


---

## International System of Units (SI)

> [!TIP] There are seven SI base units.

| Quantity            | Unit     | Symbol |
| ------------------- | -------- | ------ |
| length or distance  | meter    | $\text{m}$    |
| mass                | kilogram | $\text{kg}$   |
| time                | second   | $\text{s}$    |
| electric current    | ampere   | $\text{A}$    |
| temperature         | kelvin   | $\text{K}$    |
| amount of substance | mole     | $\text{mol}$  |
| luminous intensity  | candela  | $\text{cd}$   |

---

## Why Do We Need Other Units?

Imagine describing a car's speed like this:

> "The car travels 100 meters every 5 seconds."

<v-click>

Instead, we can express this with a **derived unit**: **meters per second** $\left(\frac{\text{m}}{\text{s}}\right)$.

</v-click>
<v-click>

> [!NOTE] Derived Unit
> A combination of base units.

</v-click>

---

## How Derived Units Work

- A derived unit comes from the **formula** that defines the quantity.

<v-click>

### Example: Area

1. **Formula:** $\text{Area} = \text{length} \times \text{width}$
2. **Base Units:** Both length and width are measured in $\text{m}$ (meters).
3. Area is measured with a **derived unit:** $\text{m} \times \text{m} = \text{m}^2$ (meters squared).

</v-click>

---

## To find a derived unit:

> [!TIP]
> 1. **Find the formula** for the quantity.
> 2. **Replace** each quantity with its **SI base unit**.
> 3. **Simplify** the expression.

---

## Example 1: Velocity

- The formula for **average velocity** is:

$$\bar v = \frac{\Delta x}{t}$$

<v-click>

- $\Delta x$, displacement, has the unit **meters ($\text{m}$)**
- $t$, time, has the unit **seconds ($\text{s}$)** .

</v-click>
<v-click>

$$\bar v = \frac{\text{m}}{\text{s}}$$
- *meters per second*

</v-click>

---

## Example 2: Acceleration

- The formula for **acceleration** is:

$$a = \frac{\Delta v}{t}$$

<v-click>

- $\Delta v$, change in velocity, has the unit $\frac{\text{m}}{\text{s}}$.
- $t$ has the unit $\text{s}$.

</v-click>
<v-click>

$$a = \frac{\frac{\text{m}}{\text{s}}}{\text{s}} = \frac{\text{m}}{\text{s}^2}$$
- *meters per second squared*

</v-click>

---

## Example 3: Force

- The formula for **force** is:

$$F = m \times a$$

<v-click>

- $m$ has the unit $\text{kg}$
- $a$ has the unit $\frac{\text{m}}{\text{s}^2}$.

</v-click>
<v-click>

$$F = \text{kg}\cdot\frac{\text{m}}{\text{s}^2} = \text{N}$$
- *kilograms meters per second squared*, *Newton*

</v-click>

---

## Special Derived Units

>[!TIP] Some derived units appear so often that they get their own names.

| Derived Quantity | Formula | Base Units | Special Name & Symbol |
| :--------------- | :------ | :--------- | :-------------------- |
| **Force**        | $F = ma$ | $\text{kg} \cdot \frac{\text{m}}{\text{s}^2}$ | **Newton ($\text{N}$)** |
| **Energy/Work**  | $W = Fd$ | $\text{kg} \cdot \frac{\text{m}^2}{\text{s}^2}$ | **Joule ($\text{J}$)** |
| **Power**        | $P = \frac{W}{t}$ | $\text{kg} \cdot \frac{\text{m}^2}{\text{s}^3}$ | **Watt ($\text{W}$)** |
| **Frequency**    | $f = \frac{1}{T}$ | $\frac{1}{\text{s}}$ | **Hertz ($\text{Hz}$)** |
| **Charge**       | $Q = I \cdot t$ | $\text{A} \cdot \text{s}$ | **Coulomb ($\text{C}$)** |

---

## The Ampere

The **ampere** ($\text{A}$) is one of the seven SI base units, but it is also defined by the coulomb. From charge $Q = I\,t$ (with $t$ in seconds):

$$1\ \text{A} = 1\ \frac{\text{C}}{\text{s}}$$

One ampere is one coulomb of charge passing each second.

---

## Practice: Calculating Velocity

Velocity is displacement over time: $v = \dfrac{\Delta x}{t}$

A jogger runs $120 \text{ m}$ east in $30 \text{ s}$. Calculate the jogger's velocity.

<v-click>

$v = \dfrac{120 \text{ m}}{30 \text{ s}}$

</v-click>

<v-click>

$v = 4 \frac{\text{m}}{\text{s}} \text{ east}$

</v-click>

---

## Practice: Calculating Acceleration

Acceleration is the change in velocity over time: $a = \dfrac{\Delta v}{t}$

The magnitude of a bicycle's velocity increases by $8 \frac{\text{m}}{\text{s}}$ over a time of $4 \text{ s}$. Calculate the magnitude of its acceleration.

<v-click>

$a = \dfrac{8 \frac{\text{m}}{\text{s}}}{4 \text{ s}}$

</v-click>

<v-click>

$a = 2 \frac{\text{m}}{\text{s}^2}$

</v-click>

---

## Practice: Calculating Force

Weight is the force of gravity: $F_g = mg$

Calculate the weight of a $50 \text{ kg}$ student standing on Earth, where $g = 9.8 \frac{\text{m}}{\text{s}^2}$.

<v-click>

$F_g = (50 \text{ kg})\left(9.8 \frac{\text{m}}{\text{s}^2}\right)$

</v-click>

<v-click>

$F_g = 490 \ \text{kg}\cdot\frac{\text{m}}{\text{s}^2}$

</v-click>

<v-click>

$F_g = 490 \ \text{N}$

</v-click>

---

## Review

<v-click>

**Base units** are the seven fundamental SI units: meter, kilogram, second, ampere, kelvin, mole, candela.

</v-click>

<v-click>

**Derived units** are combinations of base units, built from the formula that defines the quantity.

</v-click>

<v-click>

**To find a derived unit:** find the formula → replace each quantity with its base unit → simplify.

</v-click>

<v-click>

Some derived units get **special names** — like the Newton ($\text{N}$), Joule ($\text{J}$), and Watt ($\text{W}$).

</v-click>
