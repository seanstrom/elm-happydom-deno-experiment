port module Main exposing (..)

import Browser
import Dict exposing (Dict)
import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (..)
import Json.Decode as Decode exposing (Decoder)
import Json.Encode as Encode



-- Main


main : Program () Model Msg
main =
    Browser.element
        { init = init
        , update = update
        , subscriptions = subscriptions
        , view = view
        }



-- Platform


type alias Handle =
    Encode.Value


type alias Params =
    Encode.Value


type alias Context =
    Encode.Value


type alias ContextDict =
    Dict String Handle


port outbox : OutMsg Params -> Cmd msg


type alias OutMsg params =
    { params : params, context : Context }



-- Domains


type alias Query =
    { operation : String, kind : String }


type alias Response =
    List Todo


type alias Todo =
    { id : Int, name : String }


type alias Model =
    { sharedContext : ContextDict }



-- Decoders


eventDecoder : Decoder a -> Decoder a
eventDecoder helperDecoder =
    Decode.at [ "detail" ] helperDecoder


handleDecoder : Decoder Handle
handleDecoder =
    Decode.value


payloadDecoder : Decoder a -> Decoder a
payloadDecoder helperDecoder =
    eventDecoder <| Decode.field "payload" helperDecoder


contextDecoder : Decoder a -> Decoder a
contextDecoder helperDecoder =
    eventDecoder <| Decode.field "context" helperDecoder


outMsgEncoder : OutMsg Params -> Encode.Value
outMsgEncoder outMsg =
    Encode.object
        [ ( "context", outMsg.context )
        , ( "params", outMsg.params )
        ]


queryEncoder : Query -> Params
queryEncoder params =
    Encode.object
        [ ( "operation", Encode.string params.operation )
        , ( "kind", Encode.string params.kind )
        , ( "type", Encode.string "query" )
        ]


responseEncoder : Response -> Params
responseEncoder params =
    Encode.object
        [ ( "payload", Encode.list todoEncoder params )
        , ( "type", Encode.string "response" )
        ]


todoDecoder : Decoder Todo
todoDecoder =
    Decode.map2
        Todo
        (Decode.field "id" Decode.int)
        (Decode.field "name" Decode.string)


todoEncoder : Todo -> Encode.Value
todoEncoder todo =
    Encode.object
        [ ( "id", Encode.int todo.id )
        , ( "name", Encode.string todo.name )
        ]



-- Event Attributes


onAppRequest : (Handle -> msg) -> Attribute msg
onAppRequest msg =
    on "app-request" (Decode.map msg (eventDecoder handleDecoder))


onAppInit : (Handle -> msg) -> Attribute msg
onAppInit msg =
    on "app-init" (Decode.map msg (eventDecoder handleDecoder))


onAppDbPayload : (Context -> List Todo -> msg) -> Attribute msg
onAppDbPayload msg =
    on "app-db-payload" <|
        Decode.map2 msg
            (contextDecoder <| Decode.value)
            (payloadDecoder <| Decode.list todoDecoder)



-- Taaks


query : Context -> Query -> OutMsg Params
query context params =
    { params = queryEncoder params, context = context }


response : Context -> Response -> OutMsg Params
response context params =
    { params = responseEncoder params, context = context }



-- Init


init : () -> ( Model, Cmd Msg )
init _ =
    ( { sharedContext = Dict.empty }, Cmd.none )



-- Update


type Msg
    = ServerRequest Handle
    | DatabaseConnection Handle
    | DatabasePayload Context (List Todo)


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        ServerRequest requestHandle ->
            let
                hasDbHandle =
                    Dict.get "dbHandle" model.sharedContext /= Nothing
            in
            if hasDbHandle then
                let
                    localContext =
                        model.sharedContext
                            |> Dict.insert "requestHandle" requestHandle
                            |> Encode.dict identity identity

                    params =
                        { operation = "all", kind = "todo" }
                in
                ( model, outbox <| query localContext params )

            else
                ( model, Cmd.none )

        DatabaseConnection dbHandle ->
            let
                sharedContext =
                    model.sharedContext |> Dict.insert "dbHandle" dbHandle
            in
            ( { model | sharedContext = sharedContext }, Cmd.none )

        DatabasePayload encodedContext payload ->
            let
                decodedContext =
                    Decode.decodeValue
                        (Decode.dict handleDecoder)
                        encodedContext
                        |> Result.toMaybe

                mergeContext =
                    \localContext ->
                        let
                            requestHandle =
                                Dict.get "requestHandle" localContext
                        in
                        requestHandle
                            |> Maybe.map
                                (\handle ->
                                    model.sharedContext
                                        |> Dict.insert "requestHandle" handle
                                        |> Encode.dict identity identity
                                )
            in
            decodedContext
                |> Maybe.andThen mergeContext
                |> Maybe.andThen
                    (\localContext ->
                        Just
                            ( model, outbox <| response localContext payload )
                    )
                |> Maybe.withDefault ( model, Cmd.none )



-- Subscriptions


subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.none



-- View


view : Model -> Html Msg
view _ =
    app
        [ onAppRequest ServerRequest
        , onAppInit DatabaseConnection
        , onAppDbPayload DatabasePayload
        ]
        []


app : List (Attribute msg) -> List (Html msg) -> Html msg
app attrs children =
    node "x-app" attrs children
