module Client exposing (..)

import Browser
import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (..)
import Json.Decode as Decode
import Shared exposing (Todo, todoDecoder)


type alias Model =
    { todos : List Todo }


type Msg
    = Msg


init : Decode.Value -> ( Model, Cmd Msg )
init preload =
    let
        decodedPreload =
            Result.toMaybe <|
                Decode.decodeValue (Decode.list todoDecoder) preload
    in
    case decodedPreload of
        Nothing ->
            ( { todos = [] }, Cmd.none )

        Just data ->
            ( { todos = data }, Cmd.none )


update : Msg -> Model -> ( Model, Cmd Msg )
update _ model =
    ( model, Cmd.none )


viewTodo : Todo -> Html msg
viewTodo todo =
    div [] [ text todo.name ]


view : Model -> Html Msg
view model =
    div [] <| List.map viewTodo model.todos


subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.none


main : Program Decode.Value Model Msg
main =
    Browser.element
        { init = init
        , update = update
        , subscriptions = subscriptions
        , view = view
        }
