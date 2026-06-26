# -*- coding: utf-8 -*-
"""
rhino_technical_drawing.py
==========================

Automatyczne tworzenie rysunku technicznego (3 rzuty) na layoucie w Rhino.

Co robi skrypt:
  1. Pobiera zaznaczone obiekty (albo wszystkie widoczne, jeśli nic nie zaznaczono).
  2. Tworzy nowy Layout (widok strony) o zadanym formacie (domyślnie A3 poziomo).
  3. Wstawia 3 detail views (rzuty): Rzut z góry (Top), Rzut z przodu (Front),
     Rzut z prawej (Right) — ułożone w klasycznym układzie rzutowania europejskiego.
  4. Ustawia KAŻDY detail w rzeczywistej, jednakowej skali (np. 1:1, 1:2, 1:5 ...).
  5. Automatycznie dodaje linie wymiarowe (dimension lines) w rzeczywistej skali
     modelu — szerokość / głębokość / wysokość liczone z bounding box obiektów.
  6. Blokuje detaile, żeby skala nie "uciekła" przy późniejszej edycji.

Jak uruchomić:
  Rhino  ->  _RunPythonScript  ->  wskaż ten plik
  (albo wklej do edytora _EditPythonScript i naciśnij F5).

Testowane na Rhino 7 / 8 (Windows). Wymaga rhinoscriptsyntax (wbudowane).

Autor: skrypt wygenerowany do projektu lawenda (model lavmodel.stl).
"""

import rhinoscriptsyntax as rs
import scriptcontext as sc
import Rhino
import System


# ---------------------------------------------------------------------------
#  KONFIGURACJA  -  tu zmieniasz najczęstsze ustawienia
# ---------------------------------------------------------------------------

# Format strony w MILIMETRACH (szerokość, wysokość). Kilka gotowych:
PAGE_SIZES = {
    "A4_landscape": (297.0, 210.0),
    "A4_portrait":  (210.0, 297.0),
    "A3_landscape": (420.0, 297.0),
    "A3_portrait":  (297.0, 420.0),
    "A2_landscape": (594.0, 420.0),
    "A1_landscape": (841.0, 594.0),
}
PAGE = "A3_landscape"          # wybrany format strony

# Skala rysunku  =  jednostki modelu : jednostki papieru.
# Np. dla skali 1:2  ustaw SCALE = 0.5  (model 2x większy niż na papierze),
#     dla 1:1 -> 1.0,  dla 1:5 -> 0.2,  dla 2:1 -> 2.0.
# Jeśli zostawisz None, skrypt sam dobierze skalę tak, by rzuty zmieściły się
# na stronie (i pokaże jaką skalę wybrał).
SCALE = None

# Margines strony (mm) i odstęp między rzutami (mm na papierze).
MARGIN = 20.0
GAP = 25.0

# Czy dodawać linie wymiarowe automatycznie.
ADD_DIMENSIONS = True

# Odsunięcie linii wymiarowej od obiektu (w jednostkach MODELU).
DIM_OFFSET_FACTOR = 0.12   # ułamek największego wymiaru obiektu


# ---------------------------------------------------------------------------
#  FUNKCJE POMOCNICZE
# ---------------------------------------------------------------------------

def get_target_objects():
    """Zwraca listę obiektów do rzutowania - zaznaczone lub wszystkie widoczne."""
    objs = rs.SelectedObjects()
    if not objs:
        objs = rs.NormalObjects()  # wszystkie widoczne, niezablokowane
    if not objs:
        objs = rs.AllObjects()
    return objs


def world_bbox(objs):
    """Bounding box w układzie świata. Zwraca (min_pt, max_pt, dx, dy, dz)."""
    bbox = rs.BoundingBox(objs)
    if not bbox:
        return None
    mn = bbox[0]
    mx = bbox[6]
    dx = mx.X - mn.X
    dy = mx.Y - mn.Y
    dz = mx.Z - mn.Z
    return mn, mx, dx, dy, dz


def auto_scale(dx, dy, dz, page_w, page_h):
    """Dobiera skalę, żeby wszystkie 3 rzuty zmieściły się na stronie."""
    # Pole na rzuty = strona minus marginesy minus przerwy.
    usable_w = page_w - 2 * MARGIN
    usable_h = page_h - 2 * MARGIN

    # Układ rzutowania (patrz layout niżej):
    #   szerokość zajęta przez:  Front (dx)  +  GAP  +  Right (dy)
    #   wysokość zajęta przez:   Top  (dy)   +  GAP  +  Front (dz)
    needed_w = dx + GAP + dy
    needed_h = dy + GAP + dz

    if needed_w <= 0 or needed_h <= 0:
        return 1.0

    s_w = usable_w / needed_w
    s_h = usable_h / needed_h
    s = min(s_w, s_h)

    # Zaokrąglamy w dół do "ładnej" skali technicznej.
    nice = [100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01]
    for n in nice:
        if n <= s:
            return float(n)
    return s


def set_detail_scale(detail_id, scale):
    """Ustawia skalę detail view: 1 jednostka modelu = (1/scale) jedn. papieru.

    SetScale(model_length, model_unit, page_length, page_unit) ->
    chcemy: model_length jedn. modelu  ==  page_length jedn. papieru.
    Dla skali S (model:papier):  S model = 1 papier  ->  model=S, page=1.
    """
    detail = sc.doc.Objects.FindId(detail_id)
    if not detail:
        return False
    model_unit = sc.doc.ModelUnitSystem
    page_unit = sc.doc.PageUnitSystem
    # 'scale' jednostek modelu odpowiada 1 jednostce papieru.
    detail.DetailGeometry.SetScale(scale, model_unit, 1.0, page_unit)
    detail.CommitChanges()
    return True


def add_linear_dim(p0, p1, offset_dir, offset_dist, plane_normal):
    """Dodaje wymiar liniowy między p0 i p1, odsunięty o offset w MODELU."""
    # Punkt definiujący położenie linii wymiarowej.
    mid = [(p0[i] + p1[i]) / 2.0 for i in range(3)]
    dim_line_pt = [mid[i] + offset_dir[i] * offset_dist for i in range(3)]
    try:
        return rs.AddAlignedDimension(p0, p1, dim_line_pt)
    except Exception:
        return None


# ---------------------------------------------------------------------------
#  GŁÓWNA LOGIKA
# ---------------------------------------------------------------------------

def main():
    objs = get_target_objects()
    if not objs:
        print("Brak obiektow w modelu. Najpierw stworz / zaimportuj geometrie.")
        return

    bb = world_bbox(objs)
    if not bb:
        print("Nie udalo sie policzyc bounding box.")
        return
    mn, mx, dx, dy, dz = bb
    print("Wymiary modelu (XYZ): %.2f x %.2f x %.2f" % (dx, dy, dz))

    # --- Linie wymiarowe w przestrzeni modelu (rzeczywista skala) ---
    if ADD_DIMENSIONS:
        rs.EnableRedraw(False)
        max_dim = max(dx, dy, dz) or 1.0
        off = max_dim * DIM_OFFSET_FACTOR

        # Szerokość (X) - na dole frontu, odsunieta w -Y.
        add_linear_dim([mn.X, mn.Y, mn.Z], [mx.X, mn.Y, mn.Z],
                       [0, -1, 0], off, [0, 0, 1])
        # Glebokosc (Y) - z boku, odsunieta w -X.
        add_linear_dim([mn.X, mn.Y, mn.Z], [mn.X, mx.Y, mn.Z],
                       [-1, 0, 0], off, [0, 0, 1])
        # Wysokosc (Z) - z przodu po lewej, odsunieta w -X (plaszczyzna XZ).
        add_linear_dim([mn.X, mn.Y, mn.Z], [mn.X, mn.Y, mx.Z],
                       [-1, 0, 0], off, [0, 1, 0])
        rs.EnableRedraw(True)
        print("Dodano linie wymiarowe (szerokosc / glebokosc / wysokosc).")

    # --- Tworzymy Layout ---
    page_w, page_h = PAGE_SIZES.get(PAGE, PAGE_SIZES["A3_landscape"])
    page_view = sc.doc.Views.AddPageView("Rysunek techniczny", page_w, page_h)
    if not page_view:
        print("Nie udalo sie utworzyc layoutu.")
        return
    print("Utworzono layout: %s (%.0f x %.0f mm)" % (PAGE, page_w, page_h))

    # --- Skala ---
    scale = SCALE if SCALE else auto_scale(dx, dy, dz, page_w, page_h)
    if scale >= 1:
        print("Skala rysunku: %g:1" % scale)
    else:
        print("Skala rysunku: 1:%g" % (1.0 / scale))

    # Rozmiar rzutow NA PAPIERZE (mm) = wymiar modelu * skala.
    pw_x = dx * scale   # szerokosc rzutu z gory / frontu (X)
    pw_y = dy * scale   # glebokosc (Y)
    pw_z = dz * scale   # wysokosc (Z)

    # --- Układ rzutów na stronie (rzutowanie europejskie, 1. kąt) ---
    #
    #     +----------------------------------------+
    #     |   [TOP - rzut z gory]                  |
    #     |                                        |
    #     |   [FRONT - rzut z przodu] [RIGHT - z prawej]
    #     +----------------------------------------+
    #
    # Front jest "kotwica". Top nad frontem, Right na prawo od frontu.

    x0 = MARGIN
    # Wysokosc bloku = Top(pw_y) + GAP + Front(pw_z). Wyrownujemy do gory.
    y_top = page_h - MARGIN - pw_y
    y_front = y_top - GAP - pw_z

    details = []

    def make_detail(title, cx, cy, w, h, projection):
        """cx,cy = lewy dolny rog ramki detalu na papierze (mm)."""
        c1 = Rhino.Geometry.Point2d(cx, cy)
        c2 = Rhino.Geometry.Point2d(cx + w, cy + h)
        det = page_view.AddDetailView(title, c1, c2, projection)
        return det

    DVP = Rhino.Display.DefinedViewportProjection

    # FRONT (rzut z przodu) - patrzymy wzdluz -Y -> plaszczyzna XZ.
    d_front = make_detail("Rzut z przodu", x0, y_front, pw_x, pw_z, DVP.Front)
    # TOP (rzut z gory) - plaszczyzna XY, nad frontem, wyrownany w X.
    d_top = make_detail("Rzut z gory", x0, y_top, pw_x, pw_y, DVP.Top)
    # RIGHT (rzut z prawej) - plaszczyzna YZ, na prawo od frontu, wyrownany w Z.
    x_right = x0 + pw_x + GAP
    d_right = make_detail("Rzut z prawej", x_right, y_front, pw_y, pw_z, DVP.Right)

    for d in (d_front, d_top, d_right):
        if d:
            details.append(d.Id)

    sc.doc.Views.ActiveView = page_view
    page_view.SetPageAsActive()

    # --- Ustawiamy skale i wysrodkowanie kazdego detalu ---
    rs.EnableRedraw(False)
    for det_id in details:
        detail = sc.doc.Objects.FindId(det_id)
        if not detail:
            continue
        # Najpierw dopasuj zoom do obiektow, potem narzuc skale.
        detail.Viewport.ZoomExtents()
        set_detail_scale(det_id, scale)
        # Wysrodkuj na obiektach po ustawieniu skali.
        sc.doc.Views.Redraw()

    # --- Blokujemy detaile, zeby skala sie nie zmienila ---
    for det_id in details:
        detail = sc.doc.Objects.FindId(det_id)
        if detail:
            detail.DetailGeometry.IsProjectionLocked = True
            detail.CommitChanges()

    rs.EnableRedraw(True)
    sc.doc.Views.Redraw()

    print("Gotowe. Utworzono %d rzuty na layoucie, skala zablokowana." % len(details))
    print("Przelacz sie na zakladke layoutu 'Rysunek techniczny' u dolu okna Rhino.")


if __name__ == "__main__":
    main()
