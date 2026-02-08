# dSEO - Instrukcja Uzytkownika

Platforma dSEO to narzedzie do monitorowania pozycji w wyszukiwarkach, analizy backlinków, audytu technicznego stron i sledzenia konkurencji. Ponizej znajdziesz opis kazdej sekcji aplikacji wraz z informacjami, jak z niej korzystac.


## Spis tresci

1. [Logowanie i rejestracja](#1-logowanie-i-rejestracja)
2. [Panel glówny](#2-panel-glówny)
3. [Nawigacja w aplikacji](#3-nawigacja-w-aplikacji)
4. [Projekty](#4-projekty)
5. [Domeny](#5-domeny)
6. [Widok domeny — zakladki](#6-widok-domeny--zakladki)
   - 6.1 [Przeglad](#61-przeglad)
   - 6.2 [Monitoring](#62-monitoring)
   - 6.3 [Mapa slów kluczowych](#63-mapa-slów-kluczowych)
   - 6.4 [Widocznosc](#64-widocznosc)
   - 6.5 [Backlinki](#65-backlinki)
   - 6.6 [Link Building](#66-link-building)
   - 6.7 [Konkurenci](#67-konkurenci)
   - 6.8 [Analiza slów kluczowych](#68-analiza-slów-kluczowych)
   - 6.9 [On-Site](#69-on-site)
   - 6.10 [Luki w tresci](#610-luki-w-tresci)
   - 6.11 [Wnioski](#611-wnioski)
   - 6.12 [Ustawienia domeny](#612-ustawienia-domeny)
7. [Zadania w tle](#7-zadania-w-tle)
8. [Ustawienia konta](#8-ustawienia-konta)
9. [Zmiana jezyka](#9-zmiana-jezyka)
10. [Pierwsze kroki po dodaniu domeny](#10-pierwsze-kroki-po-dodaniu-domeny)


---


## 1. Logowanie i rejestracja

Po otwarciu aplikacji kliknij "Zaloguj sie" lub "Zarejestruj sie" w zaleznosci od tego, czy masz juz konto.

Do rejestracji potrzebujesz adresu e-mail i hasla. Po zalogowaniu zostaniesz przeniesiony do Panelu glównego.

Przycisk "Wyloguj sie" znajduje sie w prawym górnym rogu ekranu.


---


## 2. Panel glówny

Po zalogowaniu widzisz strone "Panel glówny" z czterema kartami podsumowania:

- Wszystkie projekty — laczna liczba projektów w Twoim koncie
- Wszystkie domeny — laczna liczba domen, które monitorujesz
- Wszystkie slowa kluczowe — suma slów kluczowych ze wszystkich domen
- Sr. pozycja — srednia pozycja Twoich slów kluczowych w wynikach wyszukiwania

Panel glówny to punkt startowy. Zeby przejsc do szczególów, uzyj menu bocznego po lewej stronie lub listy rozwijanej "Wybierz domene" w górnym pasku.


---


## 3. Nawigacja w aplikacji

Po lewej stronie ekranu znajduje sie boczne menu z nastepujacymi pozycjami:

- Panel glówny — strona startowa ze statystykami ogólnymi
- Projekty — zarzadzanie projektami (grupami domen)
- Domeny — lista wszystkich monitorowanych domen
- Zadania — podglad zadan uruchomionych w tle (skanowania, pobieranie danych)
- Ustawienia — ustawienia konta, preferencje, klucze API

W górnym pasku znajduja sie dodatkowo:

- "Wybierz domene" — rozwijana lista pozwalajaca szybko przejsc do konkretnej domeny bez koniecznosci przechodzenia przez liste domen
- Ikona globu — przelacznik jezyka (polski / angielski)
- Ikona zembatki — szybki dostep do ustawien
- Ikona dzwonka — powiadomienia
- Ikona uzytkownika — informacje o koncie

Na dole bocznego menu widoczny jest adres e-mail zalogowanego uzytkownika.

Pole "Search" (skrót klawiszowy Cmd+K lub Ctrl+K) pozwala na szybkie wyszukiwanie w calej aplikacji.


---


## 4. Projekty

Strona "Projekty" sluzy do grupowania domen w logiczne calości, np. wedlug klienta lub firmy.

Co widzisz na stronie:
- Tabela ze wszystkimi projektami — nazwa, status, liczba domen, liczba slów kluczowych, data utworzenia, wlasciciel
- Wyszukiwarka projektów
- Filtrowanie

Co mozesz zrobic:
- Dodac nowy projekt przyciskiem "Nowy projekt" (pomaranczowy przycisk w prawym górnym rogu)
- Kliknac na nazwe projektu, zeby zobaczyc jego szczególy i przypisane domeny
- Edytowac lub usunac projekt za pomoca ikon po prawej stronie wiersza (olówek = edycja, kosz = usuniecie)


---


## 5. Domeny

Strona "Domeny" to lista wszystkich stron internetowych, które monitorujesz.

Co widzisz na stronie:
- Tabela z domenami — nazwa domeny, wyszukiwarka (np. google.pl), projekt, tagi, liczba slów kluczowych, data utworzenia, status
- Wyszukiwarka domen u góry
- Filtry po tagach (np. "inhouse")
- Licznik domen (np. "5 domen")

Co mozesz zrobic:
- Dodac nowa domene przyciskiem "Dodaj domene" (pomaranczowy przycisk w prawym górnym rogu). Podajesz nazwe domeny, wybierasz projekt, wyszukiwarke (google.pl, google.com itp.), lokalizacje i czestotliwosc odswiezania
- Kliknac na nazwe domeny, zeby przejsc do szczególowego widoku z zakladkami (opisanego nizej)
- Edytowac lub usunac domene za pomoca ikon po prawej stronie wiersza


---


## 6. Widok domeny — zakladki

Po kliknieciu na domene otwiera sie szczególowy widok z dwunastoma zakladkami po lewej stronie. Kazda zakladka odpowiada innemu aspektowi analizy SEO.

Na górze strony widzisz:
- Sciezke nawigacyjna (np. Domeny > kolaboit.pl)
- Nazwe domeny z informacja o wyszukiwarce i czestotliwosci (np. "google.pl · daily")
- Ikony akcji: skopiuj adres, odswiez dane, edytuj, usun


### 6.1 Przeglad

Zakladka "Przeglad" daje szybki obraz tego, jak radzi sobie Twoja domena w wyszukiwarce.

Co widzisz:
- Wykres "Historia pozycji" — pokazuje, jak zmienialy sie pozycje Twoich slów kluczowych w czasie. Kolorowe linie oznaczaja przedzialy pozycji: Top 3 (zielony), 4-10 (pomaranczowy), 11-20 (czerwony), 21-50 (fioletowy), 51-100 (szary). Mozesz zmienic zakres dat przyciskiem "Caly okres"
- Karty "Podsumowanie" z szescioma wskaznikami:
  - Pozycje top 3 — ile slów kluczowych jest w pierwszych 3 wynikach (ze zmiana vs 7 dni temu)
  - Pozycje top 10 — ile slów kluczowych jest w pierwszych 10 wynikach
  - Wszystkie slowa kluczowe — laczna liczba slów kluczowych (z informacja: ile nowych, ile utraconych)
  - Wartosc ruchu (ETV) — szacowana wartosc ruchu organicznego
  - Ruch slów kluczowych — ile slów kluczowych zyskalo pozycje (zielone), ile stracilo (czerwone)
  - Nowe pozycje — ile nowych slów kluczowych pojawialo sie w wynikach
- Karta "Prognoza 30-dniowa" — prognoza pozycji na kolejne 30 dni (wymaga minimum 10 dni danych historycznych)


### 6.2 Monitoring

Zakladka "Monitoring" to centrum sledzenia pozycji Twoich slów kluczowych w czasie rzeczywistym.

Co widzisz:
- Badge "NA ZYWO" — informacja, ze dane sa aktualizowane automatycznie
- Wykres "Aktualny rozklad pozycji" — graficzne przedstawienie, w jakich przedzialach sa Twoje slowa kluczowe (Top 3, 4-10, 11-20, 21-50, 51-100, 100+)
- Wykres "Trend zmian pozycji (6 miesiecy)" — linia pokazujaca, ile slów zyskuje (Gainers) i traci (Losers) pozycje
- Karty statystyk: monitorowanych lacznie, srednia pozycja, szacowany miesieczny ruch, zmiany pozycji (7 dni)
- Tabela "Monitoring slów kluczowych" z kolumnami:
  - Slowo kluczowe — fraza, która monitorujesz
  - Pozycja — aktualna pozycja w Google (kolorowa: zielona = wysoka, czerwona = niska)
  - Poprzednia — pozycja z poprzedniego sprawdzenia
  - Zmiana — o ile pozycji slowo kluczowe sie przesunelo (zielona strzalka w góre = poprawa, czerwona w dól = spadek)
  - Wolumen — miesieczna liczba wyszukiwan
  - Trudnosc — ocena trudnosci pozycjonowania (skala 0-100)
  - CPC — koszt za klikniecie w Google Ads

Co mozesz zrobic:
- Dodac slowa kluczowe — pomaranczowy przycisk "Dodaj slowa kluczowe". Mozesz wpisac frazy recznie lub skorzystac z opcji "Sugestie AI", która zaproponuje 10 najlepszych fraz z odkrytych slów kluczowych
- Odswiezyc dane — przycisk "Odswiez wszystko" lub "Pobierz dane SERP"
- Kliknac na wiersz slowa kluczowego, zeby otworzyc szczególowe informacje: historyke pozycji (30 dni), wyniki SERP (top 20 stron konkurencji), trend wyszukiwan miesiecznych
- Szukac konkretnych fraz w wyszukiwarce
- Filtrowac i dostosowywac widoczne kolumny
- Usunac slowo kluczowe z monitoringu (ikona kosza)


### 6.3 Mapa slów kluczowych

Zakladka "Mapa slów kluczowych" wizualizuje calosciowa strategie slów kluczowych.

Co widzisz:
- Karty podsumowania:
  - Wszystkie slowa kluczowe — laczna liczba wykrytych fraz (z podzialem na monitorowane)
  - Typy slów kluczowych — ile fraz to glówne (short-tail), ile to dlugi ogon (long-tail), ile brandowe
  - Szybkie wygrane — ile fraz mozna latwo poprawic
  - Laczny wolumen — suma miesiecznych wyszukiwan ze srednia trudnoscia
- Wykres babelkowy "Mapa slów kluczowych" — kazda babelka to jedno slowo kluczowe. Pozycja w poziomie to trudnosc, w pionie to wolumen wyszukiwan, rozmiar to szacowany ruch (ETV). Kolory oznaczaja intencje wyszukiwania:
  - Pomaranczowy — intencja komercyjna (uzytkownik szuka produktu/uslugi)
  - Niebieski — intencja informacyjna (uzytkownik szuka wiedzy)
  - Fioletowy — intencja nawigacyjna (uzytkownik szuka konkretnej strony)
  - Szary — nieznana intencja


### 6.4 Widocznosc

Zakladka "Widocznosc" pokazuje ogólna widocznosc domeny w wynikach wyszukiwania.

Co widzisz:
- Karty metryki: wynik widocznosci, srednia pozycja, pozycje w top 3, pozycje w top 10
- Tabela "Odkryte slowa kluczowe" — slowa, na które Twoja strona pojawia sie w wynikach, ale których jeszcze nie monitorujesz aktywnie. Dla kazdego slowa widzisz: pozycje, wolumen, trudnosc, CPC, ETV

Co mozesz zrobic:
- Kliknac "Dodaj do monitoringu" przy dowolnym odkrytym slowie kluczowym, zeby zaczac je sledzic
- Odswiezyc dane przyciskiem "Odswiez slowa kluczowe"
- Szukac, filtrowac i sortowac tabele


### 6.5 Backlinki

Zakladka "Backlinki" analizuje linki prowadzace do Twojej strony z innych witryn.

Co widzisz:
- Karty podsumowania: backlinki lacznie, domeny odsylajace, odsylajace IP, linki dofollow (z procentem)
- Wykres "Backlinki w czasie" — historyczny trend wzrostu (lub spadku) backlinków. Mozesz wybrac zakres: ostatni rok, 6 miesiecy, 3 miesiace
- Wykresy rozkladu:
  - Typy platform — blogi, katalogi, fora, portale itp.
  - Atrybuty linków — podzial na dofollow / nofollow
  - Rozklad TLD — z jakich domen (.pl, .com, .eu itp.) przychodza linki
  - Kraje — z jakich krajów
  - Rozklad anchor textów — jakie teksty sa uzywane w linkach
- Tabela backlinków — pelna lista linków z adresem zródlowym, domena, anchor textem, typem, data

Co mozesz zrobic:
- Pobrac najnowsze dane przyciskiem "Pobierz backlinki"
- Kliknac na wiersz, zeby zobaczyc szczególy domeny odsylajacej
- Sortowac i filtrowac tabele


### 6.6 Link Building

Zakladka "Link Building" pomaga znalezc strony, z których warto pozyskac nowe linki.

Co widzisz:
- Karty: aktywne prospekty, sredni wynik, sredni wplyw SEO, latwe wygrane
- Tabela "Prospekty link buildingu" — lista domen, które linkuja do Twoich konkurentów, ale nie do Ciebie. Dla kazdego prospektu widzisz:
  - Domena — adres strony
  - Wynik — ocena jakosci strony (pasek: zielony = dobry, pomaranczowy = sredni, czerwony = slaby)
  - Trudnosc — jak trudno pozyskac link z tej strony
  - Wplyw — szacowany wplyw na Twoja widocznosc w Google
  - Domain Rank — autorytet domeny
  - Linki konkurentów — ile konkurentów ma link z tej strony

Co mozesz zrobic:
- Generowac raport — przycisk "Generuj raport"
- Szukac domen lub konkurentów w wyszukiwarce
- Filtrowac i dostosowywac kolumny
- Kliknac na prospekt, zeby zobaczyc szczególy kontaktowe i mozliwosci


### 6.7 Konkurenci

Zakladka "Konkurenci" pozwala zarzadzac lista konkurentów i porównywac z nimi swoje wyniki.

Co widzisz:
- Liste dodanych konkurentów z informacja o ostatnim sprawdzeniu
- Sekcje "Porównanie backlinków" — porównanie profilu backlinków z wybranym konkurentem

Co mozesz zrobic:
- Dodac konkurenta przyciskiem "Dodaj konkurenta" — wpisujesz domene konkurenta
- Przy kazdym konkurencie masz dwa przyciski:
  - "Luka w tresci" — uruchamia analize, które slowa kluczowe ma konkurent, a Ty nie
  - "Backlinki" — uruchamia analize, skad konkurent ma linki, a Ty nie
- Edytowac lub usunac konkurenta (ikony olówka i kosza)
- Porównywac backlinki — wybierasz konkurenta z listy rozwijanej i widzisz porównanie


### 6.8 Analiza slów kluczowych

Zakladka "Analiza slów kluczowych" to poglebiona analiza tresci konkurentów dla kazdego slowa kluczowego.

Co widzisz:
- Tabela "Raporty analizy slów kluczowych" z kolumnami:
  - Slowo kluczowe — analizowana fraza
  - Status — stan raportu (Zakonczone / W trakcie)
  - Konkurenci — ilu konkurentów zostalo przeanalizowanych
  - Sr. slów, Sr. H2, Sr. obrazów — srednie statystyki tresci konkurentów
  - Zalecenia — ile rekomendacji do wdrozenia

Co mozesz zrobic:
- Wygenerowac brakujace raporty przyciskiem "Generuj brakujace"
- Kliknac na wiersz, zeby zobaczyc pelny raport z rekomendacjami: ile slów, naglówków, obrazków powinien miec Twój artykul, jakie tematy pokryc, jakie slowa kluczowe umiescic
- Szukac i filtrowac raporty


### 6.9 On-Site

Zakladka "On-Site" to techniczny audyt SEO Twojej strony — skanowanie podstron i wykrywanie problemów.

Co widzisz:
- Karty problemów:
  - Ogólny stan — wynik ze 100 z litera oceny (A = doskonaly, B = dobry, C = sredni, D = slaby, F = krytyczny) i paskiem kolorów
  - Krytyczne — najwazniejsze problemy (np. wolne strony, zepsute linki). Przycisk "Pokaz problemy" wyswietla szczególy
  - Ostrzezenia — problemy sredniej wagi (np. brak tytulów, brak meta opisów, brak H1). Pokazuje top 3 kategorii problemów z liczbami
  - Rekomendacje — drobne usprawnienia (np. slaba tresc, brak danych strukturalnych)
- Sekcja "Przeglad scoringu stron" — wizualizacja jakosci wszystkich podstron:
  - Sredni wynik ogólny ze 100
  - Wykres radarowy z 4 osiami: Zdrowie techniczne, Tresc, Wydajnosc SEO, Strategia
  - Rozklad ocen — ile stron dostalo ocene A, B, C, D, F (pasek proporcji i szczególowa lista)
  - 4 karty osi z ocenami i opisami, co kazda os mierzy

Co mozesz zrobic:
- Uruchomic skanowanie: "Skanuj wybrane strony" lub "Pelne skanowanie strony"
- Kliknac "Pokaz problemy" przy karcie krytycznych/ostrzezen/rekomendacji, zeby zobaczyc liste problemów z dokladnymi adresami URL
- Przewinac nizej, zeby zobaczyc tabele przeskanowanych podstron, wyniki Page Speed, analize obrazów, lancuchy przekierowan, zepsute linki, analize robots.txt i sitemap


### 6.10 Luki w tresci

Zakladka "Luki w tresci" identyfikuje slowa kluczowe, na które pozycjonuja sie Twoi konkurenci, a Ty nie masz odpowiedniej tresci.

Co widzisz:
- Karty podsumowania: lacznie luk, wysoki priorytet, szacowana wartosc ruchu, liczba analizowanych konkurentów
- Wykres "Trendy luk" — jak zmienia sie liczba luk w czasie
- Wykres "Luka wg konkurenta" — który konkurent ma najwiecej tresci, której Ci brakuje
- Tabela "Klastry tematyczne" — powiazane slowa kluczowe pogrupowane tematycznie. Klastry pomagaja planowac artykuly, które pokryja wiele powiazanych fraz jednoczesnie

Co mozesz zrobic:
- Dodac konkurenta do analizy — przycisk "Dodaj konkurenta"
- Odswiezyc dane — przycisk "Odswiez analize"
- Kliknac na klaster, zeby zobaczyc szczególy: jakie frazy zawiera, jaki ma wolumen, jakie adresy URL konkurentów sie pozycjonuja
- Szukac, filtrowac i sortowac klastry


### 6.11 Wnioski

Zakladka "Wnioski" to zagregowany raport kondycji domeny ze wszystkich zródel danych.

Co widzisz:
- Wskaznik "Kondycja domeny" — wynik ze 100 (np. 58/100 = "Przecietna") z komentarzem i sugestiami
- "Podzial wyników" — ile punktów zdobyto w kazdym obszarze:
  - Backlinki (np. 20/30) — jakosc i ilosc linków przychodzacych
  - Tresc (np. 5/20) — jakosc i pokrycie tresci
  - Slowa kluczowe (np. 15/30) — pozycje i widocznosc
  - On-Site (np. 18/20) — zdrowie techniczne strony
- "Kluczowe metryki" — zestawienie najwazniejszych liczb: sledzone slowa, srednia pozycja, zmiany pozycji, backlinki, domeny odsylajace, luki w tresci
- "Kondycja backlinków" — podsumowanie profilu linków (lacznie, dofollow, toksyczne, nowe, prospekty)
- "Rekomendacje do dzialania" — lista konkretnych kroków, które mozesz podjac, zeby poprawic wyniki

Zakladka "Wnioski" nie wymaga zadnych dzialan — to raport, który warto sprawdzac regularnie, zeby miec obraz ogólnej kondycji SEO.


### 6.12 Ustawienia domeny

Zakladka "Ustawienia" pozwala sprawdzic i zmodyfikowac konfiguracje domeny.

Co widzisz:
- Wyszukiwarka — która wyszukiwarke sledzisz (np. google.pl)
- Czestotliwosc odswiezania — jak czesto dane sa aktualizowane (np. daily = codziennie, weekly = co tydzien)
- Lokalizacja — kraj (np. Poland)
- Jezyk — jezyk wyników (np. pl)


---


## 7. Zadania w tle

Strona "Zadania" pozwala monitorowac procesy uruchomione w tle, takie jak skanowanie stron, pobieranie backlinków czy analiza konkurentów.

Co widzisz:
- Trzy karty u góry: aktywne teraz, ukonczone dzisiaj, nieudane dzisiaj
- Trzy zakladki:
  - Aktywne — zadania aktualnie w trakcie realizacji
  - Zaplanowane — zadania czekajace na wykonanie
  - Historia — lista zakonczonych zadan

Kiedy uruchamiasz akcje typu "Pobierz backlinki", "Odswiez slowa kluczowe" lub "Pelne skanowanie strony", ich postep pojawia sie tutaj. Jesli zadanie sie nie powiodlo, zobaczysz je w karcie "Nieudane dzisiaj" i mozesz ponowic próbe.


---


## 8. Ustawienia konta

Strona "Ustawienia" pozwala zarzadzac Twoim kontem. Sklada sie z czterech zakladek:

- Profil — Twoje imie, adres e-mail, rola w systemie, data dolaczenia. Mozesz zmienic imie i zapisac przyciskiem "Zapisz zmiany"
- Preferencje — ustawienia wygladu (jasny / ciemny motyw) i inne preferencje
- Powiadomienia — konfiguracja powiadomien e-mail i w aplikacji
- Klucze API — klucze dostepu do API (do integracji z innymi narzedziami)


---


## 9. Zmiana jezyka

Aplikacja jest dostepna w dwóch jezykach: polskim i angielskim.

Zeby zmienic jezyk:
1. Kliknij ikone globu w prawym górnym rogu ekranu (obok ikony zebatki)
2. Pojawi sie lista z dwiema opcjami: "English" i "Polski" (z flagami)
3. Kliknij wybrany jezyk

Zmiana jest natychmiastowa — caly interfejs przelacza sie na wybrany jezyk.


---


## 10. Pierwsze kroki po dodaniu domeny

Kiedy dodajesz nowa domene, system automatycznie uruchamia kreator konfiguracji (Setup Wizard) w trzech krokach:

Krok 1 — Odkrywanie slów kluczowych:
System przeskanuje Twoja domene i znajdzie slowa kluczowe, na które juz sie pozycjonujesz. Mozesz uzyc przycisku "Wybierz rekomendowane", zeby automatycznie wybrać najwartosciowsze frazy, albo recznie zaznaczyc te, które chcesz monitorowac.

Krok 2 — Odkrywanie konkurentów:
System przeanalizuje wyniki wyszukiwania i zaproponuje domeny, które konkuruja z Toba o te same slowa kluczowe. Zaznacz konkurentów, których chcesz sledzic.

Krok 3 — Analiza:
System uruchomi analizy w tle — pobierze dane SERP, sprawdzi backlinki konkurentów, przeanalizuje luki w tresci. Pasek postepu pokaze, jak daleko zaszly analizy.

Po zakonczeniu kreatora zobaczysz checklist (liste kontrolna) na górze widoku domeny. Pokazuje, ile zadan ukonczone:
- Dodaj slowa kluczowe do monitoringu
- Dodaj konkurentów
- Uruchom analize konkurencji

Checklist znika po ukonczeniu wszystkich trzech kroków lub po jego recznym zamknieciu.


---


## Skróty i wskazówki

- Cmd+K (Mac) lub Ctrl+K (Windows): otwiera wyszukiwarke globalna, która pozwala szybko przejsc do dowolnej strony, domeny lub funkcji
- "Wybierz domene" w górnym pasku: szybki skok do konkretnej domeny bez przechodzenia przez liste
- Ikony akcji w tabeli domeny (prawa strona wiersza): oko = podglad, olówek = edycja, kosz = usuniecie
- Kolumny w tabelach mozna dostosowac przyciskiem "Kolumny" — ukryj niepotrzebne, pokaz dodatkowe
- Dane w tabelach mozna sortowac klikajac na naglówek kolumny (strzalka wskazuje kierunek sortowania)
- Filtry w tabelach pozwalaja zawezic widok do np. slów o wolumenie powyzej 100 czy trudnosci ponizej 30
